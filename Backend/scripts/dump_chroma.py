import sys
import os
import json

# Add Backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langgraph_agent.retrieval.vqa_store import get_vqa_store

def dump_metadata():
    store = get_vqa_store()
    print(f"Total documents: {store.collection.count()}")
    
    # Get a sample of documents to see the metadata
    results = store.collection.peek(limit=20)
    
    print("\nSample Metadata:")
    for i, meta in enumerate(results['metadatas']):
        print(f"[{i}] Location: {meta.get('location')} | Image ID: {meta.get('image_id')}")
        print(f"    Q: {meta.get('question')[:50]}...")
        print("-" * 20)

    # Count unique locations if possible (limited peek)
    all_metas = store.collection.get(include=['metadatas'], limit=100)
    unique_locs = set(m.get('location') for m in all_metas['metadatas'] if m.get('location'))
    print(f"\nUnique locations in first 100 docs: {unique_locs}")

if __name__ == "__main__":
    dump_metadata()
