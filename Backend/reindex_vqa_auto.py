import sys
import os
import time
sys.path.append(os.getcwd())

from langgraph_agent.retrieval.vqa_store import get_vqa_store

def perform_reindex():
    print("🚀 Starting AUTOMATIC Clean Re-indexing of VQA Vector Store...")
    
    project_root = os.path.dirname(os.path.abspath(__file__))
    vqa_path = os.path.join(project_root, "Data", "vqa_dataset.jsonl")
    
    if not os.path.exists(vqa_path):
        vqa_path = os.path.join(os.path.dirname(project_root), "Data", "vqa_dataset.jsonl")
    
    print(f"📊 Dataset: {vqa_path}")
    
    store = get_vqa_store()
    
    start_time = time.time()
    # force_reindex=True will call wipe_collection()
    count = store.index_from_jsonl(jsonl_path=vqa_path, force_reindex=True)
    end_time = time.time()
    
    duration = end_time - start_time
    print(f"\n✅ RE-INDEXING COMPLETE!")
    print(f"📈 Total Documents: {count}")
    print(f"⏱️ Time Taken: {duration/60:.2f} minutes")

if __name__ == "__main__":
    perform_reindex()
