import sys
import os
sys.path.append(os.getcwd())

from langgraph_agent.retrieval.vqa_store import get_vqa_store

def test_search(query):
    store = get_vqa_store()
    print(f"--- Stats ---")
    print(store.get_stats())
    
    print(f"\n--- Searching for: '{query}' ---")
    results = store.search(query, k=5, min_score=0.1)
    for i, res in enumerate(results):
        print(f"[{i+1}] Score: {res['score']:.4f} | ID: {res.get('image_id')} | Q: {res['question'][:50]}... | A: {res['answer'][:50]}...")

if __name__ == "__main__":
    query = "Ba vì có gì chơi"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
    test_search(query)
