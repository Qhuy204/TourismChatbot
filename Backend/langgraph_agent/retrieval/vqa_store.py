"""
VQA Vector Store using ChromaDB
Local vector storage for VQA knowledge retrieval
"""
import os
import json
import time
from typing import List, Dict, Optional
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer


# Default paths
DEFAULT_PERSIST_PATH = "./data/chroma_vqa"
DEFAULT_JSONL_PATH = "../Data/vqa_dataset.jsonl"

# Embedding model (multilingual, supports Vietnamese)
EMBEDDING_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


class VQAVectorStore:
    """
    Local vector store for VQA retrieval.
    Uses ChromaDB + SBERT embeddings instead of Supabase.
    """
    
    def __init__(
        self,
        persist_path: str = DEFAULT_PERSIST_PATH,
        model_name: str = EMBEDDING_MODEL
    ):
        self.persist_path = persist_path
        
        # Create persist directory if needed
        Path(persist_path).mkdir(parents=True, exist_ok=True)
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=persist_path,
            settings=Settings(anonymized_telemetry=False)
        )
        
        self.collection = self.client.get_or_create_collection(
            name="vqa_knowledge",
            metadata={"hnsw:space": "cosine"}
        )
        
        # Load embedding model
        print(f"Loading embedding model: {model_name}")
        self.encoder = SentenceTransformer(model_name)
        print("✅ Embedding model loaded")
        
        # Background indexing status
        self.indexing_in_progress = False
        self.total_docs_in_file = 0
        self.current_indexed_count = 0
    
    def wipe_collection(self):
        """Delete current collection to allow fresh indexing"""
        print(f"🧹 Wiping collection '{self.collection.name}'...")
        self.client.delete_collection(name=self.collection.name)
        self.collection = self.client.create_collection(
            name="vqa_knowledge",
            metadata={"hnsw:space": "cosine"}
        )
        self.current_indexed_count = 0
        print("✅ Collection wiped")

    def index_from_jsonl(
        self,
        jsonl_path: str = DEFAULT_JSONL_PATH,
        batch_size: int = 100,
        max_docs: Optional[int] = None,
        force_reindex: bool = False
    ) -> int:
        """
        Memory-efficient indexing with geographic context.
        """
        if force_reindex:
            self.wipe_collection()
            
        self.indexing_in_progress = True
        try:
            # Resolve path
            if not os.path.isabs(jsonl_path):
                jsonl_path = os.path.join(os.path.dirname(__file__), jsonl_path)
            
            if not os.path.exists(jsonl_path):
                raise FileNotFoundError(f"VQA dataset not found: {jsonl_path}")

            existing_count = self.collection.count()
            self.current_indexed_count = existing_count
            
            if existing_count > 0 and not force_reindex:
                print(f"📊 Resuming indexing from {existing_count} (skip re-indexing existing)...")
                if max_docs and existing_count >= max_docs:
                    return existing_count

            print(f"📁 Indexing from: {jsonl_path}")
            
            batch_docs = []
            batch_metadatas = []
            batch_ids = []
            
            total_indexed = 0
            skipped = 0
            
            with open(jsonl_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f):
                    try:
                        item = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    
                    # PRE-PROCESS: Extract location context for this image
                    geo_context = ""
                    for vqa in item.get("vqa_pairs", []):
                        if "Geographic info" in vqa.get("answer_type", ""):
                            ans = vqa.get("answers", [""])[0]
                            if ans:
                                geo_context = ans
                                break
                    
                    image_id = item.get("image_id", "N/A")
                    
                    for vqa in item.get("vqa_pairs", []):
                        # Skip if already indexed (primitive resume)
                        if not force_reindex and skipped < existing_count:
                            skipped += 1
                            continue
                            
                        if max_docs and total_indexed >= (max_docs - existing_count):
                            break
                        
                        question = vqa.get("question", "")
                        answers = vqa.get("answers", [])
                        
                        if not question or not answers:
                            continue
                        
                        answer = answers[0] if answers else ""
                        
                        # RICH CONTEXT: Prepend geographic info to help vector search
                        # Format: "[Location Context] Question? Answer"
                        doc_text = f"[{geo_context}] {question}\n{answer}" if geo_context else f"{question}\n{answer}"
                        
                        batch_docs.append(doc_text)
                        batch_metadatas.append({
                            "image_id": image_id,
                            "question": question,
                            "answer": answer,
                            "location": geo_context,
                            "answer_type": vqa.get("answer_type", ""),
                            "image_url": item.get("image_url", ""),
                            "file_path": item.get("file_path", "")
                        })
                        
                        unique_id = f"vqa_{existing_count + total_indexed + len(batch_ids)}"
                        batch_ids.append(unique_id)
                        
                        if len(batch_docs) >= batch_size:
                            self._process_batch(batch_docs, batch_ids, batch_metadatas)
                            total_indexed += len(batch_docs)
                            self.current_indexed_count = existing_count + total_indexed
                            
                            if total_indexed % 5000 == 0:
                                print(f"  ✅ Indexed {self.current_indexed_count} total...")
                            
                            batch_docs, batch_metadatas, batch_ids = [], [], []
                            time.sleep(0.01)
                    
                    if max_docs and total_indexed >= (max_docs - existing_count):
                        break
            
            if batch_docs:
                self._process_batch(batch_docs, batch_ids, batch_metadatas)
                total_indexed += len(batch_docs)
                self.current_indexed_count = existing_count + total_indexed
            
            print(f"✅ Indexing complete. Total documents: {self.collection.count()}")
            return self.collection.count()
        finally:
            self.indexing_in_progress = False

    def _process_batch(self, docs: List[str], ids: List[str], metadatas: List[Dict]):
        """Helper to encode and add a batch to ChromaDB"""
        # Generate embeddings
        embeddings = self.encoder.encode(docs, show_progress_bar=False).tolist()
        
        # Add to collection
        self.collection.add(
            documents=docs,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
    
    def search(
        self,
        query: str,
        k: int = 5,
        min_score: float = 0.3
    ) -> List[Dict]:
        """ Semantic search for relevant VQA pairs. """
        # Ensure collection still exists (in case it was wiped/re-indexed externally)
        try:
            self.collection.count()
        except Exception:
            print("🔄 Refreshing ChromaDB collection handle...")
            self.collection = self.client.get_or_create_collection(
                name="vqa_knowledge",
                metadata={"hnsw:space": "cosine"}
            )

        # Generate query embedding
        query_embedding = self.encoder.encode(query).tolist()
        
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=k,
            include=["documents", "metadatas", "distances"]
        )
        
        matches = []
        for i in range(len(results["ids"][0])):
            distance = results["distances"][0][i]
            score = 1 - distance
            
            if score < min_score:
                continue
            
            matches.append({
                "id": results["ids"][0][i],
                "image_id": results["metadatas"][0][i].get("image_id", "N/A"),
                "question": results["metadatas"][0][i].get("question", ""),
                "answer": results["metadatas"][0][i].get("answer", ""),
                "answer_type": results["metadatas"][0][i].get("answer_type", ""),
                "image_url": results["metadatas"][0][i].get("image_url", ""),
                "score": round(score, 4)
            })
        
        return matches
    
    def get_stats(self) -> Dict:
        """Get collection statistics"""
        return {
            "total_documents": self.collection.count(),
            "indexing_in_progress": self.indexing_in_progress,
            "current_indexed_count": self.current_indexed_count,
            "persist_path": self.persist_path,
            "embedding_model": EMBEDDING_MODEL
        }


# Singleton instance
_vqa_store: Optional[VQAVectorStore] = None


def get_vqa_store() -> VQAVectorStore:
    """Get or create VQA store singleton"""
    global _vqa_store
    if _vqa_store is None:
        _vqa_store = VQAVectorStore()
    return _vqa_store


def init_vqa_store(
    jsonl_path: str = DEFAULT_JSONL_PATH,
    max_docs: Optional[int] = None
) -> int:
    """Initialize VQA store and index documents"""
    store = get_vqa_store()
    return store.index_from_jsonl(jsonl_path, max_docs=max_docs)
