# MUST-FIX (Bug/Logic Errors)

Tài liệu này liệt kê các bug/logic error cần sửa trước khi release. Mỗi mục có path + line để định vị nhanh.

## Backend

1) **`new_title` có thể bị UnboundLocalError khi post-processing lỗi**
   - **File:** `Backend/langgraph_agent/graph.py:343`
   - **Bằng chứng:** `new_title` chỉ được gán trong `try`; nếu có exception trước khi gán, phần `return` vẫn dùng `new_title` (line ~416). Điều này làm request fail dù chỉ lỗi background.
   - **Fix:** Khởi tạo `new_title = None` trước `try` và trả về biến đó an toàn.

2) **Non-stream chat bỏ qua `attachments` → VQA/attachment injection không hoạt động**
   - **File:** `Backend/langgraph_agent/graph.py:314-325`
   - **Bằng chứng:** `run_graph` không nhận/không đưa `attachments` vào `initial_state`; `node_init` sẽ luôn nhận `[]`.
   - **Fix:** Thêm `attachments` vào chữ ký `run_graph` và `initial_state`, truyền từ `ChatRequest` trong `Backend/main.py`.

3) **Non-stream chat luôn trả `extracted_locations` rỗng**
   - **File:** `Backend/langgraph_agent/graph.py:343-418`
   - **Bằng chứng:** `final_locations` khởi tạo `[]` và không bao giờ được cập nhật; `extract_locations`/`fast_extract_locations` không được gọi.
   - **Fix:** Thực hiện fast/LLM extraction (hoặc gọi `extract_locations` + `store_locations`) trước khi return.

4) **Auto-titling có thể ghi đè tiêu đề do user tự đặt**
   - **File:** `Backend/langgraph_agent/graph.py:53-92`
   - **Bằng chứng:** `perform_auto_titling()` chỉ dựa vào số lượng message (`count <= 2`) mà không kiểm tra tiêu đề hiện tại có phải default hay user đã đổi; nếu user rename sớm thì vẫn bị ghi đè.
   - **Fix:** Trước khi update, kiểm tra title hiện tại có phải default/auto hay có cờ `user_renamed` trong DB.

5) **Danh mục suggestions không đồng nhất với contract**
   - **File:** `Backend/langgraph_agent/nodes/suggestions.py:10-181`
   - **Bằng chứng:** Enum chỉ có `next_step|personalized|open_ended` nhưng prompt/fallback trả `experience/food/discovery/schedule`…; frontend type cũng kỳ vọng 3 category chuẩn.
   - **Fix:** Chuẩn hoá category về 3 giá trị chuẩn, hoặc cập nhật toàn bộ frontend/type/backend contract.

6) **`exclude` trong refresh suggestions bị bỏ qua**
   - **File:** `Backend/langgraph_agent/nodes/suggestions.py:49-167`
   - **Bằng chứng:** `exclude` được truyền vào nhưng không dùng để lọc kết quả => refresh có thể lặp y hệt.
   - **Fix:** Loại bỏ suggestions trùng `exclude` trước khi trả về.

7) **`updated_at` bị ghi literal "now()" thay vì timestamp thực**
   - **File:** `Backend/langgraph_agent/memory/store.py:275-280`
   - **Bằng chứng:** Supabase Python client không thực thi SQL function; sẽ lưu chuỗi "now()" → sort theo `updated_at` sai.
   - **Fix:** Dùng `datetime.now(timezone.utc).isoformat()` hoặc DB trigger/server default.

8) **Endpoints session/history không xác thực → lộ dữ liệu & xoá nhầm**
   - **File:** `Backend/main.py:708-750` (list sessions, delete, history)
   - **Bằng chứng:** Không kiểm tra user/session ownership. Bất kỳ ai biết `user_id`/`session_id` có thể đọc hoặc xoá.
   - **Fix:** Bắt buộc auth + verify ownership (token → user_id) trước khi trả dữ liệu/xoá.

9) **Soft-delete không được tôn trọng khi list sessions**
   - **File:** `Backend/langgraph_agent/memory/store.py:245-257` + `Backend/main.py:708-713`
   - **Bằng chứng:** Admin soft-delete dùng `deleted_at`, nhưng list sessions không filter → user vẫn thấy session đã xoá.
   - **Fix:** `get_chat_sessions()` cần filter `deleted_at is null`.

## Frontend

1) **SSE parse không xử lý chunk bị cắt → mất dữ liệu/parse error**
   - **File:** `Frontend/src/hooks/useLangGraphChat.tsx:279-324`
   - **Bằng chứng:** Mỗi `chunk` được `split('\n')` và parse ngay. Nếu JSON line bị split giữa 2 chunk, sẽ lỗi parse và drop dữ liệu.
   - **Fix:** Dùng buffer (string accumulator) để chỉ parse các line hoàn chỉnh, giữ phần dư cho chunk sau.

2) **`isLoading` không được clear nếu stream kết thúc không có `content`**
   - **File:** `Frontend/src/hooks/useLangGraphChat.tsx:293-302`
   - **Bằng chứng:** `isLoading` chỉ set `false` khi nhận `content`. Nếu backend trả `metadata` + `final` (hoặc lỗi sớm), loading bubble có thể kẹt.
   - **Fix:** Khi nhận `final` hoặc `error`, đảm bảo set `isLoading=false` cho message đang load.

3) **Feedback có thể update nhầm message khi nội dung trùng prefix**
   - **File:** `Frontend/src/hooks/useLangGraphChat.tsx:421-433`
   - **Bằng chứng:** Update Supabase bằng `.ilike('message', msg.content.slice(0, 100) + '%')` có thể match nhiều bản ghi → user thấy feedback “đổi” sang message khác.
   - **Fix:** Lưu/đọc `chat_logs.id` từ backend và update theo ID thay vì match prefix nội dung.

---

Nếu bạn muốn, tôi có thể tiếp tục tạo PR/patch cho từng mục trên.
