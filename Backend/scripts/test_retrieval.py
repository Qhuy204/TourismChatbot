import asyncio
import sys
import os

# Add Backend to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langgraph_agent.retrieval.vqa_store import get_vqa_store
from langgraph_agent.nodes.intent import analyze_intent_with_llm
from langgraph_agent.nodes.location_extractor import VNAdministrativeManager

async def interactive_test():
    print("🚀 Retrieval Interactive Test Mode")
    print("Type 'exit' to quit.")
    print("-" * 50)
    
    admin_manager = VNAdministrativeManager()
    store = get_vqa_store()
    
    while True:
        query = input("\n👤 User: ")
        if query.lower() in ("exit", "quit", "q"):
            break
            
        print("🔍 Analyzing intent and location...")
        # Step 1: Detect intent and location via LLM
        # We'll use gemini_fast as default
        from langgraph_agent.state import IntentType
        intent, location = await analyze_intent_with_llm(query, model_mode="gemini")
        
        # Step 2: Normalize location
        normalized_location = location
        if location:
            prov = admin_manager.find_province(location)
            if prov:
                normalized_location = prov["name"]
                
        print(f"🎯 Intent: {intent.value}")
        print(f"📍 Extracted: {location} -> Filter: {normalized_location}")
        
        # Step 3: Search
        print(f"🔎 Searching with filter: {normalized_location or 'None'}...")
        results = store.search(query, k=5, location_filter=normalized_location)
        
        if not results:
            print("❌ No exact matches found. Trying fallback semantic search...")
            results = store.search(query, k=5)
            
        if not results:
            print("❌ No results found even in fallback.")
            continue
            
        print(f"✨ Found {len(results)} results:")
        for i, res in enumerate(results, 1):
            loc_tag = "[MATCH] " if res.get("location_match") else ""
            score_info = f"Score: {res['score']:.4f}"
            if "original_score" in res:
                score_info += f" (base: {res['original_score']:.4f})"
                
            print(f"[{i}] {loc_tag}{score_info} | Metadata Location: {res['location_metadata']}")
            print(f"    Q: {res['question']}")
            # Truncate answer for readability
            ans = res['answer']
            if len(ans) > 100:
                ans = ans[:97] + "..."
            print(f"    A: {ans}")
            print("-" * 30)

if __name__ == "__main__":
    asyncio.run(interactive_test())
