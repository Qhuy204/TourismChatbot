# MUST-FIX - All issues resolved ✅
> Last updated: 2026-03-26

## Backend Fixes

### ✅ Bug #1 — `UnboundLocalError` in auto-titling (`graph.py`)
- **Root cause:** `new_title` variable used in `return` was referenced before assignment when `perform_auto_titling()` raised inside the `try` block.
- **Fix:** Initialized `new_title = None` **before** the `try` block in `run_graph()`.

### ✅ Bug #2 — `attachments` missing from `GraphState` TypedDict (`graph.py`)
- **Root cause:** `attachments` key was used in `node_init` but not declared in the TypedDict, causing a silent `KeyError` in strict environments.
- **Fix:** Added `attachments: List[Dict]` field to `GraphState`.

### ✅ Bug #3 — Non-stream mode skips `extracted_locations` (`graph.py`)
- **Root cause:** `run_graph()` never called `fast_extract_locations()`, so it always returned `[]`.
- **Fix:** Added `fast_extract_locations()` call inside `run_graph()` post-processing block (guarded by intent type).

### ✅ Bug #5 — Suggestion categories non-standard (`suggestions.py`)
- **Root cause:** LLM returned ad-hoc strings like `"experience"`, `"food"`, `"schedule"` that did not match the `SuggestionCategory` enum `next_step/personalized/open_ended`.
- **Fix:** Added `CATEGORY_MAP` lookup table that normalizes any LLM-returned category to one of the 3 valid values.

### ✅ Bug #6 — `exclude` list not applied (`suggestions.py`)
- **Root cause:** The `exclude` parameter was accepted but never used to filter results.
- **Fix:** Added `if text in exclude or ...` filter before appending each suggestion.

### ✅ Bug #7 — `updated_at: "now()"` literal string (`store.py`)
- **Root cause:** `upsert_chat_session()` passed Python string `"now()"` instead of a real ISO timestamp. Supabase treated it as a literal string, not a DB function.
- **Fix:** Replaced with `datetime.now(timezone.utc).isoformat()`.

### ✅ Bug #8 — Session endpoints have no auth/ownership check (`main.py` + `useSessionManager.tsx`)
- **Root cause:** `GET /sessions/{user_id}`, `DELETE /sessions/{session_id}`, and `GET /history/{session_id}` had no authentication, allowing any client to access or delete any user's data.
- **Fix (Backend):** Added `Authorization: Bearer <token>` validation via `supabase.auth.get_user()` + DB lookup to confirm ownership before returning data.
- **Fix (Frontend):** Added `Authorization` header to `fetchSessions()` and `deleteSession()` calls in `useSessionManager.tsx`.

### ✅ Bug #9 — Soft-deleted sessions still appear in list (`store.py`)
- **Root cause:** `get_chat_sessions()` did not filter `deleted_at IS NULL`, so soft-deleted sessions were returned to the frontend.
- **Fix:** Added `.is_("deleted_at", "null")` filter to the Supabase query.

---

## Frontend Fixes

### ✅ Bug FE#1 — SSE chunk buffer missing (`useLangGraphChat.tsx`)
- **Root cause:** SSE lines were split by `\n` on raw decoder output without buffering. If a chunk boundary landed in the middle of a JSON line, `JSON.parse()` would fail silently and that token would be lost.
- **Fix:** Introduced `sseBuffer` string. Each decoded chunk is appended to it; only complete lines (those before the last `\n`) are processed. The incomplete tail remains in the buffer.

### ✅ Bug FE#2 — `isLoading` not cleared on `final`/`error` events (`useLangGraphChat.tsx`)
- **Root cause:** Only `content` events cleared `isLoading`. If the response was empty or if an `error` event arrived, the loading bubble would persist indefinitely.
- **Fix:** Added explicit `setMessages(... isLoading: false ...)` on both `final` and `error` event handlers.

### ✅ Bug FE#3 — Feedback update uses unreliable content prefix match (`useLangGraphChat.tsx`)
- **Root cause:** `updateFeedback()` matched the chat log row by `ILIKE message LIKE content[:100]%` — this could match the wrong row if two messages share a prefix.
- **Fix (Backend):** Backend now fetches the latest assistant `chat_logs.id` after logging and includes it as `log_id` in the SSE `final` event.
- **Fix (Frontend):** `ChatMessage` gains a `logId?: string` field. The frontend stores `log_id` from `final` event and uses `.eq('id', msg.logId)` for precise row targeting. Falls back to prefix match for old messages without `logId`.
