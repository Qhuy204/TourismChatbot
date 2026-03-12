import asyncio
import time
from typing import List, Dict
from ..memory.store import get_supabase
from .location_extractor import extract_locations, store_locations
from ..state import IntentType

async def periodic_location_extraction_loop(interval_seconds: int = 60):
    """
    Background loop that periodically checks for chat logs that need location extraction.
    """
    print(f"🔄 Background Location Extractor started (interval: {interval_seconds}s)")
    
    while True:
        try:
            client = get_supabase()
            if not client:
                await asyncio.sleep(interval_seconds)
                continue
                
            # 1. Fetch unprocessed assistant responses
            # We look for role='assistant' and context->location_extracted = false
            # We also join with the user message for better context if possible, 
            # but for now we'll just process the assistant response.
            # Actually, to get context, we should find the user message in the same session just before this.
            
            response = None
            try:
                # Use ->> operator for text comparison of JSON values to avoid 'Token False is invalid' errors
                response = client.table("chat_logs") \
                    .select("id, session_id, message, context") \
                    .eq("role", "assistant") \
                    .eq("context->>location_extracted", "false") \
                    .limit(10) \
                    .execute()
                logs_to_process = response.data or []
            except Exception as e:
                error_str = str(e)
                if "JSON could not be generated" in error_str:
                    # This is tricky. If we can't select, we can't process.
                    # But maybe we can try an even simpler select or just skip this batch.
                    print("⚠️ Background Worker: Supabase JSON error during select. Retrying...")
                    # Try to parse manually from 'details' if it's there
                    import re
                    # Details might contain a list of objects. This is getting complex.
                    # For now, let's just log and try again later.
                    await asyncio.sleep(interval_seconds)
                    continue
                else:
                    raise e
            
            if not logs_to_process:
                # No work to do
                await asyncio.sleep(interval_seconds)
                continue
                
            print(f"🔍 Background Worker: Processing {len(logs_to_process)} records...")
            
            for log in logs_to_process:
                log_id = log["id"]
                session_id = log["session_id"]
                bot_message = log["message"]
                context = log["context"] or {}
                
                # Check intent from context
                intent = context.get("intent")
                if intent in [IntentType.CHIT_CHAT.value, IntentType.UNRELATED.value, IntentType.META_INSTRUCTION.value]:
                    # Skip extraction for these intents
                    context["location_extracted"] = True
                    try:
                        client.table("chat_logs").update({"context": context}).eq("id", log_id).execute()
                    except:
                        pass # Ignore parsing error on update
                    continue

                # Get user message for context (optional but recommended)
                user_msg_res = None
                user_message = ""
                try:
                    user_msg_res = client.table("chat_logs") \
                        .select("message") \
                        .eq("session_id", session_id) \
                        .eq("role", "user") \
                        .lt("id", log_id) \
                        .order("id", desc=True) \
                        .limit(1) \
                        .execute()
                    if user_msg_res.data:
                        user_message = user_msg_res.data[0]["message"]
                except:
                    print(f"⚠️ Could not fetch user context for log {log_id}")
                
                combined_text = f"User: {user_message}\nAssistant: {bot_message}"
                
                # 2. Run AI extraction
                try:
                    loc_objects = await extract_locations(combined_text)
                    if loc_objects:
                        # 3. Store in locations_cache
                        await store_locations(loc_objects, source_response_id=log_id)
                except Exception as e:
                    print(f"⚠️ Background extraction failed for log {log_id}: {e}")
                
                # 4. Mark as processed
                context["location_extracted"] = True
                try:
                    client.table("chat_logs").update({"context": context}).eq("id", log_id).execute()
                except Exception as e:
                    if "JSON could not be generated" in str(e):
                        pass # Succeeded on DB level
                    else:
                        print(f"⚠️ Warning: Context update failed for log {log_id}: {e}")
                
            print(f"✅ Background Worker: Finished batch of {len(logs_to_process)}")
            
        except Exception as e:
            print(f"❌ Background Location Extractor loop error: {e}")
            
        await asyncio.sleep(interval_seconds)
