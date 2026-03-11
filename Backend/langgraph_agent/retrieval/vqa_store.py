import os
import json
import time
from typing import List, Dict, Optional, Union
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer


# Default paths
DEFAULT_PERSIST_PATH = "./data/chroma_vqa"
DEFAULT_JSONL_PATH = "../../../Data/vqa_dataset.jsonl"

# Embedding model (multilingual, supports Vietnamese)
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Collection Definitions
COLLECTIONS = {
    "places": "Landmarks, parks, museums, and sightseeing spots",
    "hotels": "Resorts, hotels, homestays, and accommodation",
    "food": "Restaurants, street food, markets, and specialties",
    "itinerary": "Schedules, day-by-day plans, and tour routes",
    "transport": "Airports, stations, transport hubs, and vehicle info"
}

# Routing Keywords (Lowercased)
ROUTING_KEYWORDS = {
    "places": ["chùa", "thắng cảnh", "di tích", "bãi biển", "bảo tàng", "đền", "tôn giáo", "cầu", "đảo", "vịnh", "hồ", "núi", "hang động", "công viên", "thung lũng", "bán đảo", "cung điện", "lăng", "tháp", "đài kỷ niệm", "rừng", "đỉnh núi", "thác"],
    "hotels": ["khu nghỉ dưỡng", "khách sạn", "resort", "homestay", "biệt thự", "nhà nghỉ", "nghỉ ngơi", "chỗ ở", "accommodation"],
    "food": ["chợ", "ẩm thực", "nhà hàng", "quán ăn", "đặc sản", "món ăn", "uống", "cà phê", "street food", "chợ nổi", "chợ đêm", "chợ phiên"],
    "itinerary": ["lịch trình", "tour", "hành trình", "chuyến đi", "ngày 1", "ngày 2", "lịch trình du lịch", "kế hoạch"],
    "transport": ["cửa khẩu", "bến tàu", "sân bay", "ga tàu", "phương tiện", "di chuyển", "xe buýt", "taxi", "thuê xe", "cáp treo", "đèo"]
}

class VQAVectorStore:
    """
    Enhanced vector store for VQA retrieval with multi-collection support.
    """
    
    def __init__(
        self,
        persist_path: str = DEFAULT_PERSIST_PATH,
        model_name: str = EMBEDDING_MODEL
    ):
        self.persist_path = persist_path
        Path(persist_path).mkdir(parents=True, exist_ok=True)
        
        self.client = chromadb.PersistentClient(
            path=persist_path,
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Initialize all collections
        self.collections = {}
        for name in COLLECTIONS:
            self.collections[name] = self.client.get_or_create_collection(
                name=name,
                metadata={"hnsw:space": "cosine", "description": COLLECTIONS[name]}
            )
        
        # Legacy handle for compatibility
        self.collection = self.collections["places"]
        
        print(f"Loading embedding model: {model_name}")
        self.encoder = SentenceTransformer(model_name)
        print("✅ Multi-collection VQA Store loaded")
        
        self.indexing_in_progress = False
        self.current_indexed_count = 0

    def wipe_all_collections(self):
        """Delete all collections for fresh indexing"""
        for name in COLLECTIONS:
            print(f"🧹 Wiping collection '{name}'...")
            try:
                self.client.delete_collection(name=name)
            except:
                pass
            self.collections[name] = self.client.create_collection(
                name=name,
                metadata={"hnsw:space": "cosine", "description": COLLECTIONS[name]}
            )
        print("✅ All collections wiped")

    def _get_target_collection(self, geo_context: str, text_content: str) -> str:
        """Route document to the best collection based on keywords"""
        full_text = f"{geo_context} {text_content}".lower()
        
        # Priority 1: Direct keyword match in geo_context (usually contains the Type)
        for cat, keywords in ROUTING_KEYWORDS.items():
            if any(k in geo_context.lower() for k in keywords):
                return cat
                
        # Priority 2: Keyword match in full text
        for cat, keywords in ROUTING_KEYWORDS.items():
            if any(k in full_text for k in keywords):
                return cat
                
        # Default
        return "places"

    def index_from_jsonl(
        self,
        jsonl_path: str = DEFAULT_JSONL_PATH,
        batch_size: int = 100,
        max_docs: Optional[int] = None,
        force_reindex: bool = False
    ) -> int:
        """
        Memory-efficient indexing with Category Routing.
        """
        if force_reindex:
            self.wipe_all_collections()
            
        self.indexing_in_progress = True
        try:
            if not os.path.isabs(jsonl_path):
                jsonl_path = os.path.join(os.path.dirname(__file__), jsonl_path)
            
            if not os.path.exists(jsonl_path):
                raise FileNotFoundError(f"VQA dataset not found: {jsonl_path}")

            # Note: total count now spans all collections
            existing_count = sum(c.count() for c in self.collections.values())
            self.current_indexed_count = existing_count
            
            if existing_count > 0 and not force_reindex:
                print(f"📊 Resuming indexing from {existing_count} total existing docs...")
                if max_docs and existing_count >= max_docs:
                    return existing_count

            print(f"📁 Indexing from: {jsonl_path} with Category Routing")
            
            # Buckets for batches by collection
            buckets = {name: {"docs": [], "metadatas": [], "ids": []} for name in COLLECTIONS}
            
            total_indexed = 0
            skipped = 0
            
            with open(jsonl_path, 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        item = json.loads(line)
                    except:
                        continue
                    
                    # Extract Location & Type context
                    geo_context = ""
                    geo_type = ""
                    for vqa in item.get("vqa_pairs", []):
                        atype = vqa.get("answer_type", "")
                        if "Geographic info - Name" in atype:
                            geo_context = vqa.get("answers", [""])[0]
                        if "Geographic info - Type" in atype:
                            geo_type = vqa.get("answers", [""])[0]
                    
                    image_id = item.get("image_id", "N/A")
                    
                    for vqa in item.get("vqa_pairs", []):
                        if not force_reindex and skipped < existing_count:
                            skipped += 1
                            continue
                            
                        if max_docs and total_indexed >= (max_docs - existing_count):
                            break
                        
                        question = vqa.get("question", "")
                        answer = vqa.get("answers", [""])[0] if vqa.get("answers") else ""
                        
                        if not question or not answer:
                            continue
                        
                        # Route to correct collection
                        target = self._get_target_collection(geo_type or geo_context, f"{question} {answer}")
                        
                        doc_text = f"[{geo_context}] {question}\n{answer}" if geo_context else f"{question}\n{answer}"
                        
                        buckets[target]["docs"].append(doc_text)
                        buckets[target]["metadatas"].append({
                            "image_id": image_id,
                            "question": question,
                            "answer": answer,
                            "location": geo_context,
                            "type": geo_type,
                            "answer_type": vqa.get("answer_type", ""),
                            "image_url": item.get("image_url", ""),
                            "file_path": item.get("file_path", "")
                        })
                        
                        unique_id = f"vqa_{existing_count + total_indexed + len(buckets[target]['ids'])}"
                        buckets[target]["ids"].append(unique_id)
                        
                        # Process batch if any bucket is full
                        if len(buckets[target]["docs"]) >= batch_size:
                            self._process_batch(target, buckets[target]["docs"], buckets[target]["ids"], buckets[target]["metadatas"])
                            total_indexed += len(buckets[target]["docs"])
                            self.current_indexed_count = existing_count + total_indexed
                            buckets[target] = {"docs": [], "metadatas": [], "ids": []}
                            
                            if total_indexed % 1000 == 0:
                                print(f"  ✅ Indexed {self.current_indexed_count} total...")
                    
                    if max_docs and total_indexed >= (max_docs - existing_count):
                        break
            
            # Final flush
            for name, data in buckets.items():
                if data["docs"]:
                    self._process_batch(name, data["docs"], data["ids"], data["metadatas"])
                    total_indexed += len(data["docs"])
            
            self.current_indexed_count = existing_count + total_indexed
            print(f"✅ Multi-collection Indexing complete. Total: {self.current_indexed_count}")
            return self.current_indexed_count
        finally:
            self.indexing_in_progress = False

    def _process_batch(self, collection_name: str, docs: List[str], ids: List[str], metadatas: List[Dict]):
        embeddings = self.encoder.encode(docs, show_progress_bar=False).tolist()
        self.collections[collection_name].add(
            documents=docs,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

    from functools import lru_cache
    @lru_cache(maxsize=128)
    def _cached_encode(self, text: str):
        return self.encoder.encode(text).tolist()

    def search(
        self,
        query: str,
        k: int = 5,
        min_score: float = 0.3,
        location_filter: Optional[str] = None,
        preferred_collection: str = "places"
    ) -> List[Dict]:
        """ Specialized search across collections with intent routing. """
        
        # 1. Routing logic: Which collections to search?
        # We can search the preferred one plus a fallback or two
        search_targets = [preferred_collection]
        if preferred_collection != "places":
            search_targets.append("places") # Always fallback to general places
            
        final_matches = []
        query_embedding = self._cached_encode(query)
        
        # Split k across collections or search each for k and merge? Search each to ensure quality candidates.
        for target in search_targets:
            if target not in self.collections: continue
            
            coll = self.collections[target]
            fetch_k = k * 2 if location_filter else k
            
            results = coll.query(
                query_embeddings=[query_embedding],
                n_results=fetch_k,
                include=["documents", "metadatas", "distances"]
            )
            
            for i in range(len(results["ids"][0])):
                distance = results["distances"][0][i]
                score = 1 - distance
                if score < min_score: continue
                
                metadata = results["metadatas"][0][i]
                doc_loc = str(metadata.get("location", "")).lower()
                
                boosted_score = score
                match_found = False
                if location_filter:
                    clean_filter = location_filter.lower()
                    if clean_filter in doc_loc or doc_loc in clean_filter:
                        boosted_score += 0.2
                        match_found = True
                
                final_matches.append({
                    "id": results["ids"][0][i],
                    "collection": target,
                    "image_id": metadata.get("image_id", "N/A"),
                    "question": metadata.get("question", ""),
                    "answer": metadata.get("answer", ""),
                    "location_metadata": metadata.get("location", ""),
                    "type": metadata.get("type", ""),
                    "score": round(boosted_score, 4),
                    "location_match": match_found,
                    "image_url": metadata.get("image_url", ""),
                    "file_path": metadata.get("file_path", "")
                })

        # Sort all candidates
        final_matches.sort(key=lambda x: x["score"], reverse=True)
        
        if location_filter and any(m["location_match"] for m in final_matches):
            loc_matches = [m for m in final_matches if m["location_match"]]
            other_matches = [m for m in final_matches if not m["location_match"]]
            return (loc_matches + other_matches)[:k]
            
        return final_matches[:k]

    def get_stats(self) -> Dict:
        return {
            "collections": {name: c.count() for name, c in self.collections.items()},
            "total_documents": sum(c.count() for c in self.collections.values()),
            "indexing_in_progress": self.indexing_in_progress,
            "embedding_model": EMBEDDING_MODEL
        }

_vqa_store: Optional[VQAVectorStore] = None

def get_vqa_store() -> VQAVectorStore:
    global _vqa_store
    if _vqa_store is None:
        _vqa_store = VQAVectorStore()
    return _vqa_store

def init_vqa_store(jsonl_path: str = DEFAULT_JSONL_PATH, max_docs: Optional[int] = None) -> int:
    store = get_vqa_store()
    return store.index_from_jsonl(jsonl_path, max_docs=max_docs)
