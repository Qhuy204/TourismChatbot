# Chatbot Behavior Test Cases

## Test Suite: Image Request Handling

### TC01: Direct Image Request with Location Name
**Input**: "Gửi ảnh Hồ Gươm Hà Nội"
**Expected**: Bot hiển thị ảnh ngay lập tức với markdown: `![Hồ Gươm](url)`
**KHÔNG ĐƯỢC**: Hỏi "góc nào?", "khu vực nào?", "có nhiều địa điểm..."

### TC02: Short Image Request After Discussion
**Context**: Đang thảo luận về Chùa Chuông, Hưng Yên
**Input**: "Có ảnh không?"
**Expected**: Bot tìm trong history → Hiển thị ảnh Chùa Chuông
**KHÔNG ĐƯỢC**: Hỏi "ảnh địa điểm nào?", nhảy sang địa điểm khác

### TC03: Image Request - No Image in Database
**Input**: "Gửi ảnh [địa điểm không có ảnh]"
**Expected**: "Hiện chưa có hình ảnh trong cơ sở dữ liệu"
**KHÔNG ĐƯỢC**: Hỏi clarification

### TC04: Multiple Photos Same Location (Deduplication)
**Data**: 10 records "Biển Vô Cực, Thái Bình" với 10 ảnh khác nhau
**Input**: "Gửi ảnh Biển Vô Cực Thái Bình"
**Expected**: Bot chọn 1 ảnh (đầu tiên) và hiển thị
**KHÔNG ĐƯỢC**: Hỏi "góc nào?", liệt kê 10 options

---

## Test Suite: Context Handling

### TC05: Follow-up Question Maintains Context
**Turn 1**: "Chùa gì ở Hưng Yên?" → Bot: Chùa Chuông, Chùa Hiến
**Turn 2**: "Đường đi như thế nào?"
**Expected**: Bot trả lời về đường đi đến Chùa Chuông/Chùa Hiến
**KHÔNG ĐƯỢC**: Nhảy sang địa điểm hoàn toàn khác

### TC06: Generic Query Extracts Context from History
**Input**: "Có ảnh không" (sau khi thảo luận Đà Nẵng)
**Expected Keywords**: ['đà', 'nẵng'] từ history, không phải ['ảnh']
**Verify Log**: `Generic/Short query detected, extracting context from conversation history`

### TC07: Stop Words Filter Image-Related Terms
**Input**: "Có ảnh không"
**Expected Keywords After Filter**: [] (empty - all are stop words)
**Stop Words Applied**: 'có', 'ảnh', 'không' → filtered out
**Result**: Falls back to history extraction

---

## Test Suite: Response Style

### TC08: First Message - Greeting Allowed
**Turn 1**: "Xin chào, có gì hay ở Đà Nẵng?"
**Expected**: Có thể bắt đầu với greeting ngắn gọn
**OK**: "Đà Nẵng có nhiều điểm đến tuyệt vời! 🏖️..."

### TC09: Follow-up - No Repeated Greeting
**Turn 2+**: "Còn ẩm thực thì sao?"
**Expected**: Trả lời trực tiếp, KHÔNG lặp lại "Chào bạn! 👋"
**OK**: "Về ẩm thực Đà Nẵng, bạn nên thử..."
**KHÔNG ĐƯỢC**: "Chào bạn! 👋 Về ẩm thực..."

### TC10: Emoji Usage - Not Excessive
**Any Response**
**Expected**: 1-3 emoji max per response
**KHÔNG ĐƯỢC**: Mỗi dòng đều có emoji

---

## Test Suite: Deduplication Logic

### TC11: Same Name + City = Single Location
**Data**: 
- Record A: "Biển Vô Cực", city: "Thái Bình", image: url1
- Record B: "Biển Vô Cực", city: "Thái Bình", image: url2
- Record C: "Biển Vô Cực", city: "Ninh Thuận", image: url3
**Expected After Dedup**:
- 1x "Biển Vô Cực, Thái Bình" (merged, có image của record A)
- 1x "Biển Vô Cực, Ninh Thuận" (separate)
**Verify Log**: `📍 Deduplicated: 3 → 2 unique locations`

### TC12: QA Pairs Merged Without Duplicates
**Data**: 2 records same location, each with 5 QA pairs (2 duplicates)
**Expected**: Merged location has 5 unique QA pairs (not 10)

---

## Test Suite: Session Management

### TC13: Auto-Resume Last Session on Load
**Precondition**: User has existing session with messages
**Action**: Reload page
**Expected**: Most recent session auto-loaded with all messages
**Verify Log**: `Restoring most recent session: [title]`

### TC14: New Conversation Clears Session
**Action**: Click "Hội thoại mới" button
**Expected**: Messages cleared, new session ID generated
**State**: currentSessionId = null, sessionIdRef = new UUID

### TC15: Delete Session
**Action**: Hover session → Click X → Confirm
**Expected**: Session soft-deleted (is_active=false), removed from list
**If Current**: Chat cleared, new session started

---

## Manual Verification Checklist

- [ ] Image displays correctly with rounded corners
- [ ] Auto-scroll works when new message arrives
- [ ] Scroll-to-bottom button appears when scrolled up
- [ ] Session list shows in sidebar
- [ ] Delete button appears on hover
- [ ] Console shows RAG context logs
- [ ] Console shows deduplication logs
- [ ] Console shows image path logs (🖼️)
