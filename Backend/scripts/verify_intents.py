
import asyncio
from langgraph_agent.nodes.intent import analyze_intent_with_llm
from langgraph_agent.state import IntentType

async def verify_queries():
    test_queries = [
        "Địa điểm du lịch đẹp ở Hà Nội",
        "Ăn gì ở Đà Nẵng",
        "Giới thiệu về Ải Chi Lăng",
        "Lịch sử Văn Miếu Quốc Tử Giám",
        "Giá vé vào Bà Nà Hills là bao nhiêu?",
        "Chùa Hương mở cửa lúc mấy giờ?",
        "Đi từ Nội Bài vào trung tâm Hà Nội bằng phương tiện gì?",
        "Lên lịch trình đi Sapa 3 ngày 2 đêm",
        "Chào bạn, bạn khỏe không?",
        "Viết code python cho hàm tính tổng",
    ]
    
    print(f"{'Query':<60} | {'Intent':<20} | {'Location':<20}")
    print("-" * 105)
    
    for query in test_queries:
        intent, location = await analyze_intent_with_llm(query, model_mode="gemini")
        print(f"{query:<60} | {intent.value:<20} | {str(location):<20}")

if __name__ == "__main__":
    asyncio.run(verify_queries())
