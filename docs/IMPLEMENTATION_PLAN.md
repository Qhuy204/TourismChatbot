# 🗺️ TOURISM CHATBOT — IMPLEMENTATION PLAN (v2.0)

> **Ngày tạo:** 2026-02-24
> **Trạng thái:** PLANNING
> **Tác giả:** Qhuy + Antigravity AI

---

## MỤC LỤC

1. [PHASE 1: Real-time APIs (Thời tiết + Tỷ giá)](#phase-1)
2. [PHASE 2: Itinerary Optimization (Lên lịch trình tối ưu)](#phase-2)
3. [PHASE 3: Hotel & Price Database (CSDL Giá cả)](#phase-3)
4. [PHASE 4: Booking Integration (Affiliate Links)](#phase-4)
5. [PHASE 5: Wishlist & UI Cards](#phase-5)
6. [Phụ lục: So sánh API Providers](#appendix)

---

<a id="phase-1"></a>
## PHASE 1: Real-time APIs — Tool Calling (Thời tiết, Tỷ giá)

### 🎯 Mục tiêu
Biến Chatbot từ "tra cứu kiến thức tĩnh" thành "trợ lý thời gian thực" bằng cách tích hợp **Function Calling / Tool Use** vào LangGraph.

### 📊 Impact Analysis

| Chiều ảnh hưởng | Tăng/Giảm tải | Mức độ | Lý do kỹ thuật |
|:---|:---|:---|:---|
| **UX Quality** | Tăng mạnh | HIGH | Bot trả lời "Mai Đà Lạt 18°C mưa nhẹ" thay vì "Đà Lạt thường mát mẻ" |
| **Latency** | Tăng nhẹ | LOW | Thêm 200-500ms cho API call, chạy song song với LLM |
| **Cost** | Tăng nhẹ | LOW | OpenWeatherMap free 60 calls/min, ExchangeRate free 1500/month |
| **Architecture** | Tăng | MED | Thêm 1 Node mới vào LangGraph + tool registry |

### 🔧 Giải pháp kỹ thuật

#### 1.1 OpenWeatherMap API (Thời tiết)

```
Free Tier: 60 calls/phút, 1,000,000 calls/tháng
Endpoint: api.openweathermap.org/data/2.5/forecast
Data: Dự báo 5 ngày / 3 giờ
Params: q={city},VN&appid={key}&units=metric&lang=vi
```

**Schema trả về cần thiết:**
```json
{
  "city": "Đà Lạt",
  "forecast": [
    {"date": "2026-02-25", "temp_min": 15, "temp_max": 22, "weather": "mưa nhẹ", "humidity": 85}
  ]
}
```

#### 1.2 ExchangeRate API (Tỷ giá)

```
Free Tier: 1,500 calls/tháng (ExchangeRate-API.com)
Endpoint: v6.exchangerate-api.com/v6/{key}/latest/VND
Dùng cho: Du khách ngoại quốc hỏi "1 USD bằng bao nhiêu VND?"
```

#### 1.3 Kiến trúc Tool Calling trong LangGraph

```
User: "Mai đi Đà Lạt có mưa không?"
  ↓
Intent Classifier → travel_query + weather_needed=true
  ↓
┌─────────────────────────────────────┐
│ node_tool_call (MỚI)               │
│  ├─ weather_tool(city="Đà Lạt")    │  ← Song song
│  └─ retrieve_context(query)         │  ← Song song
└─────────────────────────────────────┘
  ↓
node_generate (LLM nhận thêm tool_results trong prompt)
  ↓
"Ngày mai Đà Lạt dự báo 18°C, mưa nhẹ vào chiều. Bạn nên mang áo khoác."
```

#### 1.4 Files cần tạo/sửa

| File | Hành động | Mô tả |
|:---|:---|:---|
| `Backend/langgraph_agent/tools/weather.py` | **TẠO MỚI** | Wrapper OpenWeatherMap + cache 30 phút |
| `Backend/langgraph_agent/tools/exchange_rate.py` | **TẠO MỚI** | Wrapper tỷ giá + cache 1 giờ |
| `Backend/langgraph_agent/tools/__init__.py` | **TẠO MỚI** | Tool registry |
| `Backend/langgraph_agent/graph.py` | **SỬA** | Thêm `node_tool_call` sau `node_intent` |
| `Backend/langgraph_agent/nodes/intent.py` | **SỬA** | Thêm detection `needs_weather`, `needs_exchange` |
| `Backend/.env` | **SỬA** | Thêm `OPENWEATHER_API_KEY`, `EXCHANGERATE_API_KEY` |

#### 1.5 Pseudocode

```python
# tools/weather.py
import httpx
from functools import lru_cache

CACHE_TTL = 1800  # 30 phút

class WeatherTool:
    """Tra cứu thời tiết thời gian thực cho các thành phố Việt Nam"""
    
    async def get_forecast(self, city: str, days: int = 3) -> dict:
        # 1. Check cache (Redis hoặc in-memory dict)
        # 2. Call OpenWeatherMap API
        # 3. Parse & format kết quả sang tiếng Việt
        # 4. Cache kết quả
        url = f"https://api.openweathermap.org/data/2.5/forecast"
        params = {"q": f"{city},VN", "appid": API_KEY, "units": "metric", "lang": "vi"}
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params)
        return self._format_forecast(resp.json(), days)
```

#### 1.6 Ước lượng thời gian: **2-3 ngày**

---

<a id="phase-2"></a>
## PHASE 2: Itinerary Optimization (Lên lịch trình tối ưu)

### 🎯 Mục tiêu
Khi user yêu cầu "Lịch trình Đà Nẵng 3 ngày", Bot không chỉ sinh text mà còn **tối ưu thứ tự địa điểm** theo khoảng cách thực tế, tránh tình trạng "sáng Bắc chiều Nam".

### 📊 Impact Analysis

| Chiều ảnh hưởng | Tăng/Giảm tải | Mức độ | Lý do kỹ thuật |
|:---|:---|:---|:---|
| **UX Quality** | Tăng rất mạnh | HIGH | Lịch trình hợp lý về mặt địa lý, tiết kiệm thời gian di chuyển |
| **Latency** | Tăng | MED | Thêm 1-2s cho Google Maps API + thuật toán TSP |
| **Cost** | Tăng | MED | Google Routes API ~$5/1000 requests (Free tier 10K/tháng) |
| **Complexity** | Tăng | HIGH | Cần thuật toán graph + API tích hợp |

### 🔧 Giải pháp kỹ thuật — 3 phương án

#### Phương án A: Google Maps Directions API + `optimize:true` ⭐ KHUYÊN DÙNG

**Cách hoạt động:**
```
1. LLM sinh ra danh sách N điểm đến (text) cho lịch trình
2. Geocode từng điểm → lat/lng (Google Geocoding API)  
3. Gọi Google Directions API với optimize:true
4. API tự động sắp xếp lại thứ tự waypoints tối ưu
5. Trả về thứ tự mới + thời gian di chuyển giữa các điểm
6. LLM viết lại lịch trình theo thứ tự đã tối ưu
```

**Ưu điểm:**
- Google tự lo thuật toán TSP (không cần tự code)
- Có data giao thông thời gian thực
- Free 10,000 requests/tháng (Essentials tier, từ 03/2025)

**Nhược điểm:**
- Giới hạn 25 waypoints/request (đủ cho lịch trình du lịch)
- Cần billing account Google Cloud

**API Call mẫu:**
```
GET https://maps.googleapis.com/maps/api/directions/json
  ?origin=Sân bay Đà Nẵng
  &destination=Sân bay Đà Nẵng
  &waypoints=optimize:true|Bà Nà Hills|Cầu Rồng|Bãi biển Mỹ Khê|Chùa Linh Ứng|Phố cổ Hội An
  &key=API_KEY
  &language=vi
```

**Response chứa:**
```json
{
  "geocoded_waypoints": [...],
  "routes": [{
    "waypoint_order": [2, 0, 3, 1, 4],  // ← Thứ tự tối ưu!
    "legs": [
      {"distance": "5.2 km", "duration": "12 phút", "start_address": "..."},
      ...
    ]
  }]
}
```

#### Phương án B: TSP tự code (Nearest Neighbor + 2-opt) — Backup nếu không muốn dùng Google

```python
# Thuật toán Nearest Neighbor + 2-opt improvement
# Dùng khi: Không muốn phụ thuộc Google Maps, hoặc > 25 điểm

import numpy as np
from itertools import combinations

def nearest_neighbor_tsp(distance_matrix: np.ndarray, start: int = 0) -> list[int]:
    """Greedy Nearest Neighbor TSP solver"""
    n = len(distance_matrix)
    visited = [False] * n
    path = [start]
    visited[start] = True
    
    for _ in range(n - 1):
        current = path[-1]
        nearest = min(
            (i for i in range(n) if not visited[i]),
            key=lambda i: distance_matrix[current][i]
        )
        path.append(nearest)
        visited[nearest] = True
    return path

def two_opt_improve(path: list[int], distance_matrix: np.ndarray) -> list[int]:
    """2-opt local search improvement"""
    improved = True
    while improved:
        improved = False
        for i, j in combinations(range(1, len(path)), 2):
            if j - i == 1: continue
            new_path = path[:i] + path[i:j+1][::-1] + path[j+1:]
            if total_distance(new_path, distance_matrix) < total_distance(path, distance_matrix):
                path = new_path
                improved = True
    return path
```

**Nguồn distance matrix:**
- Tính Haversine distance (miễn phí, offline) cho ước lượng nhanh
- Hoặc dùng Google Distance Matrix API cho chính xác hơn

#### Phương án C: OSRM (Open Source Routing Machine) — Self-hosted, miễn phí 100%

```
Docker: docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/vietnam-latest.osm.pbf
API: http://localhost:5000/trip/v1/driving/{coordinates}?roundtrip=false&source=first&destination=last
```

**Ưu điểm:** Hoàn toàn miễn phí, không giới hạn requests
**Nhược điểm:** Cần RAM ~2GB cho data VN, không có traffic data

### 🏗️ Kiến trúc tích hợp (Phương án A — Google Maps)

```
Intent: itinerary_request
  ↓
node_generate (LLM sinh raw itinerary với danh sách điểm)
  ↓
node_optimize_itinerary (MỚI)
  ├─ 1. Parse danh sách điểm từ LLM response
  ├─ 2. Geocode mỗi điểm → lat/lng
  ├─ 3. Gọi Directions API (optimize:true)
  ├─ 4. Nhận waypoint_order + travel times
  └─ 5. Rewrite itinerary theo thứ tự tối ưu
  ↓
yield optimized_response + travel_times
```

#### Files cần tạo/sửa

| File | Hành động | Mô tả |
|:---|:---|:---|
| `Backend/langgraph_agent/tools/maps.py` | **TẠO MỚI** | Google Maps Directions + Geocoding wrapper |
| `Backend/langgraph_agent/nodes/itinerary_optimizer.py` | **TẠO MỚI** | Node tối ưu lịch trình |
| `Backend/langgraph_agent/graph.py` | **SỬA** | Thêm node sau generate khi intent=itinerary |
| `Backend/.env` | **SỬA** | Thêm `GOOGLE_MAPS_API_KEY` |

#### Ước lượng thời gian: **3-5 ngày**

---

<a id="phase-3"></a>
## PHASE 3: Hotel & Price Database (CSDL Giá cả)

### 🎯 Mục tiêu
Cung cấp dữ liệu giá thực tế (khách sạn, vé máy bay ước lượng) để Bot không "phóng tác" khi user hỏi về ngân sách.

### ❓ Câu hỏi quan trọng: **Crawl data hay dùng API?**

#### So sánh chi tiết:

| Tiêu chí | 🕷️ Crawl Data | 🔌 API (Agoda/Booking) |
|:---|:---|:---|
| **Chi phí** | Miễn phí (nhưng tốn công duy trì) | Miễn phí (Affiliate) hoặc trả phí (B2B) |
| **Dữ liệu real-time** | ❌ Không (cần crawl lại hàng ngày/tuần) | ✅ Có (giá live) |
| **Pháp lý** | ⚠️ Rủi ro vi phạm ToS | ✅ Hợp pháp 100% |
| **Độ tin cậy** | ❌ Dễ bị block, HTML thay đổi | ✅ Ổn định, có SLA |
| **Khối lượng data** | ✅ Lấy được toàn bộ | ⚠️ Tùy thuộc API quota |
| **Thời gian setup** | 3-5 ngày (Scrapy + xử lý) | 1-2 ngày (đọc docs + integrate) |
| **Maintenance** | ❌ Cao (selector thay đổi liên tục) | ✅ Thấp |
| **Phù hợp cho** | Nghiên cứu, dataset tĩnh | Production, real-time |

### ⭐ ĐỀ XUẤT: Chiến lược KẾT HỢP (Hybrid)

```
┌─────────────────────────────────────────────────────┐
│                HYBRID DATA STRATEGY                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Layer 1: STATIC DATABASE (Crawl 1 lần)             │
│  ├─ Danh sách 5000+ khách sạn VN (tên, sao, vị trí)│
│  ├─ Khoảng giá tham khảo (budget/mid/luxury)        │
│  ├─ Amenities, reviews tổng hợp                    │
│  └─ Source: TripAdvisor VN Dataset (Zenodo)         │
│           + Agoda listings scrape (1 lần)            │
│                                                     │
│  Layer 2: REAL-TIME PRICING (API)                   │
│  ├─ Agoda Affiliate API → giá phòng live            │
│  ├─ Khi user hỏi cụ thể: "KS 3 sao ở Huế bao nhiêu?"│
│  └─ Trả kèm affiliate link để book                 │
│                                                     │
│  Layer 3: LLM ESTIMATION (Fallback)                 │
│  ├─ Khi API unavailable hoặc không tìm thấy        │
│  └─ Dùng data Layer 1 + kiến thức LLM để ước lượng │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 🔧 Chi tiết triển khai

#### 3.1 Layer 1: Static Database (Crawl 1 lần + cập nhật hàng tháng)

**Nguồn dữ liệu:**
- **TripAdvisor VN Hotels Dataset** (Zenodo — công khai, hợp pháp): ~6000 khách sạn với reviews, ratings
- **Google Maps Places API** (Free 5000 calls/tháng): Lấy thông tin cơ bản (tên, địa chỉ, rating, price_level)

**Schema Supabase:**
```sql
CREATE TABLE hotels (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_normalized TEXT NOT NULL,
    city TEXT,
    province TEXT,
    star_rating SMALLINT,          -- 1-5
    price_tier TEXT,                -- 'budget' | 'mid' | 'luxury'
    price_estimate_vnd INT,        -- Giá ước lượng/đêm (VND)
    latitude FLOAT,
    longitude FLOAT,
    amenities TEXT[],               -- ['wifi', 'pool', 'beach_access']
    review_score FLOAT,             -- 0-10
    review_count INT,
    source TEXT,                    -- 'tripadvisor' | 'google' | 'agoda'
    booking_url TEXT,               -- Affiliate link
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE flight_price_estimates (
    id SERIAL PRIMARY KEY,
    origin_city TEXT NOT NULL,       -- 'Hà Nội'
    destination_city TEXT NOT NULL,  -- 'Đà Nẵng'
    price_range_min INT,            -- VND
    price_range_max INT,            -- VND
    airline TEXT,
    season TEXT,                    -- 'peak' | 'off_peak'
    data_month TEXT,                -- '2026-02'
    source TEXT                     -- 'manual' | 'skyscanner_estimate'
);
```

**Script Crawl (1 lần):**
```python
# scripts/crawl_hotels.py
# Dùng Google Maps Places API (hợp pháp) để lấy danh sách KS top ở mỗi tỉnh

import httpx
import asyncio

PROVINCES = ["Hà Nội", "Đà Nẵng", "Hồ Chí Minh", "Huế", "Đà Lạt", ...]

async def fetch_hotels_for_city(city: str):
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": f"khách sạn {city}",
        "key": GOOGLE_MAPS_KEY,
        "language": "vi",
        "type": "lodging"
    }
    # Lấy top 60 kết quả (3 trang x 20)
    # Parse: name, rating, price_level, geometry, place_id
    # Map price_level (0-4) → price_tier + estimate VND
```

#### 3.2 Layer 2: Real-time Pricing (Agoda Affiliate API)

**Đăng ký:**
1. Vào https://partners.agoda.com → Đăng ký Affiliate Program
2. Sau khi approved → nhận API Key + Affiliate ID
3. Dùng Hotel Search API để query giá live

**Flow tích hợp:**
```
User: "Khách sạn 3 sao ở Huế giá bao nhiêu?"
  ↓
Intent: accommodation + budget_query
  ↓
node_tool_call:
  ├─ 1. Query hotels table: WHERE province='Huế' AND star_rating=3
  ├─ 2. Agoda API: search(city="Hue", stars=3, checkin=..., checkout=...)
  └─ 3. Merge results + generate affiliate links
  ↓
LLM Response:
  "Khách sạn 3 sao ở Huế dao động 400K-800K/đêm. Một số gợi ý:
   1. Moonlight Hotel Hue — 450K/đêm ⭐4.2 [Đặt phòng →]
   2. Cherish Hue Hotel — 550K/đêm ⭐4.5 [Đặt phòng →]"
```

#### Files cần tạo/sửa

| File | Hành động | Mô tả |
|:---|:---|:---|
| `Backend/scripts/crawl_hotels.py` | **TẠO MỚI** | Script crawl 1 lần bằng Google Places API |
| `Backend/scripts/seed_flight_prices.py` | **TẠO MỚI** | Seed dữ liệu giá vé tham khảo (manual) |
| `Backend/langgraph_agent/tools/hotel_search.py` | **TẠO MỚI** | Query Supabase + Agoda API |
| `Backend/langgraph_agent/tools/budget_estimator.py` | **TẠO MỚI** | Ước lượng chi phí chuyến đi |
| `supabase/migrations/xxx_hotels.sql` | **TẠO MỚI** | Schema tables mới |

#### Ước lượng thời gian: **5-7 ngày**

---

<a id="phase-4"></a>
## PHASE 4: Booking Integration (Affiliate Links)

### 🎯 Mục tiêu
Khi Bot gợi ý khách sạn/vé máy bay, tự động chèn **Affiliate Deep Links** để user có thể book trực tiếp và project kiếm hoa hồng.

### 📊 So sánh Affiliate Platforms

| Nền tảng | Có API? | Hoa hồng | Phù hợp VN? | Ghi chú |
|:---|:---|:---|:---|:---|
| **Agoda** | ✅ Có (Affiliate API) | 5-7% | ✅ Rất tốt | API trả về giá + deep link. Inventory mạnh ở SEA |
| **Booking.com** | ⚠️ Hạn chế (Demand API) | 25-40% | ✅ Tốt | Phải được duyệt Managed Affiliate. Hoa hồng cao nhất |
| **Traveloka** | ✅ Có (Partners Network) | 3-5% | ✅ Rất tốt | Mạnh ở VN (flights + hotels). Non-branded API integration |
| **Skyscanner** | ✅ Có (Travel API) | CPC model | ⚠️ Trung bình | Chỉ flights. Redirect model, không booking trực tiếp |
| **Klook** | ✅ Có (Affiliate) | 3-5% | ✅ Tốt | Activities & tours. Deep links cho trải nghiệm |

### ⭐ ĐỀ XUẤT: Bắt đầu với **Agoda + Traveloka** (dễ apply nhất, phù hợp VN nhất)

### 🔧 Triển khai

#### 4.1 Deep Link Generation

```python
# tools/affiliate.py

class AffiliateLinker:
    """Tạo affiliate deep links cho các nền tảng booking"""
    
    AGODA_TEMPLATE = "https://www.agoda.com/partners/partnersearch.aspx?pcs=1&cid={affiliate_id}&hid={hotel_id}&checkIn={checkin}&checkOut={checkout}"
    TRAVELOKA_TEMPLATE = "https://www.traveloka.com/vi-vn/hotel/search?spec={city}&checkIn={checkin}&checkOut={checkout}&affiliate={affiliate_id}"
    
    def generate_hotel_link(self, platform: str, hotel_id: str, checkin: str, checkout: str) -> str:
        ...
    
    def generate_flight_link(self, origin: str, dest: str, date: str) -> str:
        # Traveloka flight search link
        ...
```

#### 4.2 Tích hợp vào Generator

```python
# Trong node_generate, khi intent = accommodation:
# 1. LLM sinh response text 
# 2. Post-process: Detect tên khách sạn trong response
# 3. Lookup hotel_id từ DB
# 4. Chèn [Đặt phòng](affiliate_link) sau mỗi khách sạn
```

#### 4.3 Frontend: Render Cards thay vì Plain Text

```tsx
// components/HotelCard.tsx
interface HotelCardProps {
    name: string;
    stars: number;
    price: string;
    rating: number;
    imageUrl: string;
    bookingUrl: string;  // Affiliate link
}

// Bot response chứa structured data:
// <!--hotel:{"name":"Moonlight Hotel","stars":3,"price":"450K","url":"..."}-->
// Frontend parse và render thành Card UI đẹp
```

#### Ước lượng thời gian: **3-4 ngày** (sau khi Phase 3 xong)

---

<a id="phase-5"></a>
## PHASE 5: Wishlist & Location Cards (UI)

### 🎯 Mục tiêu
Cho phép user "Lưu" địa điểm yêu thích và hiển thị thông tin dưới dạng Card thay vì Markdown thuần.

### 🔧 Triển khai

#### 5.1 Supabase Table

```sql
CREATE TABLE user_wishlist (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    location_name TEXT NOT NULL,
    province TEXT,
    category TEXT,
    notes TEXT,
    added_at TIMESTAMP DEFAULT NOW()
);
```

#### 5.2 Frontend Components

```
LocationCard:
  ┌─────────────────────────────────────┐
  │ 🏖️ Bãi biển Mỹ Khê                │
  │ Đà Nẵng • ⭐ 4.7 • Beach           │
  │                                     │
  │ [💾 Lưu] [🗺️ Bản đồ] [📋 Thêm vào LT]│
  └─────────────────────────────────────┘
```

#### Ước lượng thời gian: **2-3 ngày**

---

<a id="appendix"></a>
## PHỤ LỤC: Tổng hợp API Keys cần đăng ký

| API | Provider | Free Tier | Đăng ký |
|:---|:---|:---|:---|
| OpenWeatherMap | openweathermap.org | 60 calls/phút | Tự do, instant |
| ExchangeRate API | exchangerate-api.com | 1,500 calls/tháng | Tự do, instant |
| Google Maps Platform | console.cloud.google.com | 10K calls/tháng (Essentials) | Cần billing account |
| Agoda Affiliate | partners.agoda.com | Unlimited (affiliate) | Cần website/app, duyệt 3-5 ngày |
| Traveloka Partners | travelokapartnersnetwork.com | Tùy plan | Cần website/app, duyệt 5-7 ngày |

---

## TIMELINE TỔNG THỂ

```
Week 1:  PHASE 1 — Weather API + Exchange Rate (2-3 ngày)
         PHASE 5 — Wishlist UI (2-3 ngày, song song)

Week 2:  PHASE 2 — Itinerary Optimizer (3-5 ngày)

Week 3:  PHASE 3 — Hotel Database + Crawl (5-7 ngày)

Week 4:  PHASE 4 — Booking Affiliate Links (3-4 ngày)
         Polish + Testing + Demo
```

**Tổng ước lượng: 3-4 tuần** cho toàn bộ 5 phases.

---

## KIẾN TRÚC SAU KHI HOÀN THÀNH

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                  │
│  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ │
│  │Chat UI │ │Hotel Card│ │ Wishlist │ │Itinerary Map │ │
│  └────┬───┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘ │
└───────┼──────────┼────────────┼─────────────────┼────────┘
        │          │            │                 │
┌───────┼──────────┼────────────┼─────────────────┼────────┐
│       ▼          ▼            ▼                 ▼        │
│              BACKEND (FastAPI + LangGraph)                │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                   LANGGRAPH                         │ │
│  │                                                     │ │
│  │  init → context → intent → emotion                  │ │
│  │                     ↓                               │ │
│  │              ┌──────┴──────┐                        │ │
│  │              ▼             ▼                        │ │
│  │         tool_call     retrieve                      │ │
│  │         ┌──┴──┐         │                          │ │
│  │         ▼     ▼         ▼                          │ │
│  │     weather hotel    VQA DB                        │ │
│  │     exchange maps                                  │ │
│  │         └──┬──┘         │                          │ │
│  │            └─────┬──────┘                          │ │
│  │                  ▼                                 │ │
│  │              generate                              │ │
│  │                  ↓                                 │ │
│  │         itinerary_optimize (if applicable)         │ │
│  │                  ↓                                 │ │
│  │           affiliate_enrich (if applicable)         │ │
│  │                  ↓                                 │ │
│  │            suggestions → END                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Supabase │ │ Weather  │ │ Google   │ │  Agoda /   │  │
│  │ (hotels, │ │ API      │ │ Maps API │ │  Traveloka │  │
│  │  wishes) │ │          │ │          │ │  API       │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└──────────────────────────────────────────────────────────┘
```
