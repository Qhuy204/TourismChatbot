
import asyncio
from langgraph_agent.memory.store import log_chat
from langgraph_agent.state import IntentType

async def seed():
    user_id = "00000000-0000-0000-0000-000000000001"
    session_id = "00000000-0000-0000-0000-000000000001"
    
    # Locations to seed
    locations = [
        ("Hồ Hoàn Kiếm Hà Nội", "Hà Nội", "travel_query"),
        ("Ăn gì ở Phố Cổ Hà Nội", "Hà Nội", "food_recommendation"),
        ("Chinh phục đỉnh Fansipan Sapa", "Lào Cai", "travel_query"),
        ("Lịch trình du lịch Đà Lạt 3 ngày", "Lâm Đồng", "itinerary_request"),
        ("Vịnh Hạ Long có đẹp không", "Quảng Ninh", "travel_query"),
        ("Chợ nổi Cái Răng Cần Thơ", "Cần Thơ", "travel_query"),
        ("Ẩm thực Huế có gì ngon", "Thừa Thiên Huế", "food_recommendation")
    ]
    
    for msg, loc, intent in locations:
        print(f"Logging: {msg} -> {loc}")
        await log_chat(
            user_id=user_id,
            session_id=session_id,
            message=msg,
            response="Đây là thông tin về " + loc,
            intent=intent,
            location=loc
        )

if __name__ == "__main__":
    asyncio.run(seed())
