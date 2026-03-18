
import asyncio
from langgraph_agent.retrieval.vqa_store import get_vqa_store

async def migrate(max_docs=10000):
    store = get_vqa_store()
    print(f"🚀 Starting Migration to Multi-Collection (Max docs: {max_docs})")
    
    # Wipe to ensure clean collections
    # store.wipe_all_collections() # Careful here if we want to preserve data, 
    # but since schema changed, we SHOULD wipe.
    
    store.index_from_jsonl(max_docs=max_docs, force_reindex=True)
    
    stats = store.get_stats()
    print("\n📊 Migration Results:")
    print(json.dumps(stats, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    import json
    asyncio.run(migrate(10000))
