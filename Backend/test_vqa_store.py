"""
Test script for VQA Vector Store
Run: python test_vqa_store.py
"""
import os
import sys
import time

# Setup path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    print("=" * 60)
    print("Phase 2: VQA Vector Store - Test")
    print("=" * 60)
    
    # Test 1: Initialize store
    print("\n✅ Test 1: Initialize VQA Store")
    try:
        from langgraph_agent.retrieval.vqa_store import VQAVectorStore
        
        store = VQAVectorStore(persist_path="./data/chroma_vqa_test")
        stats = store.get_stats()
        print(f"  - Persist path: {stats['persist_path']}")
        print(f"  - Existing docs: {stats['total_documents']}")
        print("  ✅ Store initialized!")
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return
    
    # Test 2: Index documents (limited for testing)
    print("\n✅ Test 2: Index VQA Documents (max 100 for quick test)")
    try:
        start_time = time.time()
        
        jsonl_path = os.path.join(
            os.path.dirname(__file__),
            "../Data/vqa_dataset.jsonl"
        )
        
        count = store.index_from_jsonl(jsonl_path, max_docs=100)
        elapsed = time.time() - start_time
        
        print(f"  - Documents indexed: {count}")
        print(f"  - Time: {elapsed:.2f}s")
        print("  ✅ Indexing complete!")
    except FileNotFoundError as e:
        print(f"  ⚠️ Dataset not found: {e}")
        print("  Skipping remaining tests...")
        return
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return
    
    # Test 3: Semantic search
    print("\n✅ Test 3: Semantic Search")
    test_queries = [
        "Đà Nẵng có gì đẹp?",
        "Cột mốc A Pa Chải ở đâu?",
        "Món ăn ngon ở Hà Nội",
    ]
    
    for query in test_queries:
        print(f"\n  Query: '{query}'")
        try:
            results = store.search(query, k=3, min_score=0.3)
            
            if results:
                for i, r in enumerate(results):
                    print(f"    [{i+1}] Score: {r['score']:.3f}")
                    print(f"        Q: {r['question'][:60]}...")
                    print(f"        A: {r['answer'][:80]}...")
            else:
                print("    No results found (score < 0.3)")
        except Exception as e:
            print(f"    ❌ Error: {e}")
    
    # Test 4: Stats
    print("\n✅ Test 4: Collection Stats")
    stats = store.get_stats()
    print(f"  - Total documents: {stats['total_documents']}")
    print(f"  - Embedding model: {stats['embedding_model']}")
    
    print("\n" + "=" * 60)
    print("VQA Vector Store tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
