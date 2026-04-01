"""
Background Worker – Location Extraction & Daily Batch Processing
================================================================
Flow:
  1. Sau mỗi lượt chat: lưu text vào một bảng staging in-memory.
  2. Cuối mỗi ngày (hoặc khi staging đầy): chạy AI extraction trên toàn bộ
     staging → upsert vào locations_cache (Supabase).

Bảng staging (in-memory):
  _staged_responses: list[dict]
    keys: log_id, session_id, combined_text, timestamp, intent
"""

import asyncio
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional

from ..memory.store import get_supabase
from .location_extractor import extract_locations, store_locations
from ..state import IntentType
from utils.config_manager import config


# ---------------------------------------------------------------------------
# In-memory staging table
# ---------------------------------------------------------------------------

_staged_responses: List[Dict] = []
_staging_lock = asyncio.Lock()

# Intents that do NOT need location extraction (skip staging entirely)
_SKIP_INTENTS = {
    IntentType.CHIT_CHAT.value,
    IntentType.UNRELATED.value,
    IntentType.META_INSTRUCTION.value,
}


# Maximum items to keep in memory before auto-flushing to DB
_MAX_STAGED_ITEMS = config.get('database.extraction_staging_limit', 3)


async def stage_response(
    log_id: int,
    session_id: str,
    combined_text: str,
    intent: Optional[str] = None,
) -> None:
    """
    Stage a bot response for location extraction.
    Flushes automatically if threshold is reached.
    """
    if intent in _SKIP_INTENTS:
        return

    entry = {
        "log_id": log_id,
        "session_id": session_id,
        "combined_text": combined_text,
        "intent": intent,
        "staged_at": datetime.now(timezone.utc).isoformat(),
    }

    should_flush = False
    async with _staging_lock:
        _staged_responses.append(entry)
        if len(_staged_responses) >= _MAX_STAGED_ITEMS:
            should_flush = True

    print(f"📋 Staged log_id={log_id} (total staged: {len(_staged_responses)}/{_MAX_STAGED_ITEMS})")

    if should_flush:
        print(f"🚀 Staging threshold reached ({_MAX_STAGED_ITEMS}). Triggering auto-flush...")
        # Run flush in background task to not block the current chat flow
        asyncio.create_task(flush_staged_locations())


async def get_staging_stats() -> Dict:
    """Return current staging table stats (for /health or admin endpoints)."""
    async with _staging_lock:
        count = len(_staged_responses)
        oldest = _staged_responses[0]["staged_at"] if count else None
    return {
        "staged_count": count, 
        "max_staged_items": _MAX_STAGED_ITEMS,
        "oldest_staged_at": oldest
    }


async def get_staged_responses(limit: int = 50) -> List[Dict]:
    """Return staged responses list for dashboard inspection."""
    async with _staging_lock:
        snapshot = list(_staged_responses[-limit:])  # Latest N
    result = []
    for e in reversed(snapshot):  # Newest first
        text = e["combined_text"]
        # Split into user/assistant parts for display
        lines = text.split("\n", 1)
        user_line   = lines[0].replace("User: ", "", 1) if len(lines) > 0 else ""
        assist_line = lines[1].replace("Assistant: ", "", 1) if len(lines) > 1 else ""
        result.append({
            "log_id":     e["log_id"],
            "session_id": e["session_id"][:8] + "…",
            "intent":     e["intent"],
            "staged_at":  e["staged_at"],
            "user_preview":      user_line[:120] + ("…" if len(user_line) > 120 else ""),
            "response_preview":  assist_line[:200] + ("…" if len(assist_line) > 200 else ""),
        })
    return result


# ---------------------------------------------------------------------------
# End-of-day flush (AI extraction + DB store)
# ---------------------------------------------------------------------------

async def flush_staged_locations() -> int:
    """
    Process all staged responses:
      1. Run AI extraction on each combined_text.
      2. Batch-upsert to locations_cache in Supabase.
      3. Mark corresponding chat_logs rows as location_extracted=True.
    Returns total number of locations stored.
    """
    async with _staging_lock:
        if not _staged_responses:
            print("📭 No staged responses to process.")
            return 0
        # Snapshot and clear the staging table atomically
        snapshot = list(_staged_responses)
        _staged_responses.clear()

    print(f"🌙 End-of-day flush: processing {len(snapshot)} staged responses...")

    client = get_supabase()
    total_stored = 0
    processed_log_ids: List[int] = []

    for entry in snapshot:
        log_id = entry["log_id"]
        combined_text = entry["combined_text"]

        try:
            loc_objects = await extract_locations(combined_text)
            if loc_objects:
                stored = await store_locations(loc_objects, source_response_id=log_id)
                total_stored += stored
        except Exception as e:
            print(f"⚠️ Extraction failed for log_id={log_id}: {e}")

        processed_log_ids.append(log_id)

    # Mark all processed chat_logs as extracted (batch update)
    if client and processed_log_ids:
        try:
            for log_id in processed_log_ids:
                # Fetch current context to avoid overwriting other fields
                res = client.table("chat_logs").select("context").eq("id", log_id).execute()
                ctx = (res.data[0].get("context") or {}) if res.data else {}
                ctx["location_extracted"] = True
                client.table("chat_logs").update({"context": ctx}).eq("id", log_id).execute()
        except Exception as e:
            print(f"⚠️ Batch context-update error: {e}")

    print(f"✅ End-of-day flush complete: {total_stored} locations stored from {len(snapshot)} responses.")
    return total_stored


# ---------------------------------------------------------------------------
# Scheduler – runs flush once per day at midnight (server local time)
# ---------------------------------------------------------------------------

def _seconds_until_midnight_utc() -> float:
    """Return seconds remaining until next UTC midnight."""
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return (tomorrow - now).total_seconds()


async def daily_location_flush_loop() -> None:
    """
    Background loop that waits until midnight UTC, flushes the staging table,
    then repeats every 24 hours.
    """
    print("🕛 Daily Location Flush scheduler started.")

    while True:
        wait_secs = _seconds_until_midnight_utc()
        next_run = datetime.now(timezone.utc) + timedelta(seconds=wait_secs)
        print(f"⏰ Next end-of-day flush at {next_run.strftime('%Y-%m-%d %H:%M:%S UTC')}"
              f" (in {wait_secs/3600:.1f}h)")

        await asyncio.sleep(wait_secs)

        try:
            await flush_staged_locations()
        except Exception as e:
            print(f"❌ Daily flush error: {e}")

        # Wait a moment before computing the next midnight
        await asyncio.sleep(1)


# ---------------------------------------------------------------------------
# Legacy background worker (kept as fallback to mark already-logged rows)
# ---------------------------------------------------------------------------

async def periodic_location_extraction_loop(interval_seconds: Optional[int] = None) -> None:
    """
    LEGACY: Background loop that processes chat_logs rows where
    location_extracted = false but were logged before the new staging
    system was deployed.  Runs less aggressively (once per interval).
    """
    if interval_seconds is None:
        interval_seconds = config.get('database.extraction_cycle_seconds', 60)
        
    print(f"🔄 Legacy Background Location Extractor started (interval: {interval_seconds}s)")

    while True:
        try:
            client = get_supabase()
            if not client:
                await asyncio.sleep(interval_seconds)
                continue

            try:
                response = (
                    client.table("chat_logs")
                    .select("id, session_id, message, context")
                    .eq("role", "assistant")
                    .eq("context->>location_extracted", "false")
                    .limit(config.get('database.extraction_batch_size', 5))
                    .execute()
                )
                logs_to_process = response.data or []
            except Exception as e:
                if "JSON could not be generated" in str(e):
                    print("⚠️ Legacy Worker: Supabase JSON error during select. Skipping batch.")
                    await asyncio.sleep(interval_seconds)
                    continue
                raise

            if not logs_to_process:
                await asyncio.sleep(interval_seconds)
                continue

            print(f"🔍 Legacy Worker: found {len(logs_to_process)} unprocessed records – staging them.")

            for log in logs_to_process:
                log_id = log["id"]
                session_id = log["session_id"]
                bot_message = log["message"]
                context = log["context"] or {}
                intent = context.get("intent")

                if intent in _SKIP_INTENTS:
                    context["location_extracted"] = True
                    try:
                        client.table("chat_logs").update({"context": context}).eq("id", log_id).execute()
                    except Exception:
                        pass
                    continue

                # Fetch paired user message for context
                user_message = ""
                try:
                    user_res = (
                        client.table("chat_logs")
                        .select("message")
                        .eq("session_id", session_id)
                        .eq("role", "user")
                        .lt("id", log_id)
                        .order("id", desc=True)
                        .limit(1)
                        .execute()
                    )
                    if user_res.data:
                        user_message = user_res.data[0]["message"]
                except Exception:
                    pass

                combined_text = f"User: {user_message}\nAssistant: {bot_message}"

                # Stage instead of extracting immediately
                await stage_response(
                    log_id=log_id,
                    session_id=session_id,
                    combined_text=combined_text,
                    intent=intent,
                )

                # Mark as "staged" so we don't pick it up again
                context["location_extracted"] = "staged"
                try:
                    client.table("chat_logs").update({"context": context}).eq("id", log_id).execute()
                except Exception as e:
                    if "JSON could not be generated" not in str(e):
                        print(f"⚠️ Context update failed for log {log_id}: {e}")

        except Exception as e:
            print(f"❌ Legacy Location Extractor loop error: {e}")

        await asyncio.sleep(interval_seconds)
