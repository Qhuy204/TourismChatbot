import os
import time
import yaml
from typing import Optional, Dict, List
from dataclasses import dataclass

from ..memory.store import get_supabase
from ..utils.gemini_client import gemini_fast

# Initialize configs from YAML
_config_path = os.path.join(os.path.dirname(__file__), "..", "configs", "evaluator.yaml")
try:
    with open(_config_path, "r", encoding="utf-8") as f:
        _eval_config = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Error loading evaluator config: {e}")
    _eval_config = {"stop_words": []}

STOP_WORDS = set(_eval_config.get("stop_words", []))


@dataclass
class EvaluationMetrics:
    """Metrics collected for each response"""
    response_latency_ms: int
    context_relevance: float  # Average score of retrieved contexts
    context_count: int
    model_used: str
    hallucination_score: float
    response_length: int


def compute_hallucination_score_heuristic(
    response: str, 
    retrieved_contexts: List[Dict]
) -> float:
    """
    Estimate hallucination by checking if response claims 
    are present in retrieved contexts using keyword overlap.
    Returns 0-1 score (lower = less hallucination).
    """
    if not retrieved_contexts:
        return 0.5  # Unknown, no context to compare
    
    # Combine all context text
    context_text = " ".join([
        ctx.get("answer", "") + " " + ctx.get("question", "")
        for ctx in retrieved_contexts
    ]).lower()
    
    # Get meaningful words from response
    response_words = set(response.lower().split())
    context_words = set(context_text.split())
    
    # Filter common Vietnamese stop words (loaded from config)
    response_words -= STOP_WORDS
    
    if not response_words:
        return 0.0
    
    # Overlap ratio - higher overlap = lower hallucination
    overlap = len(response_words & context_words) / len(response_words)
    
    # Invert: high overlap = low hallucination
    # Being more lenient: if overlap > 40%, it's likely fine
    if overlap > 0.4:
        return round(max(0.0, 0.4 - overlap) / 0.4, 3) * 0.3 # Scale down high scores
    
    return round(1.0 - min(overlap, 1.0), 3)


async def compute_hallucination_score_llm(
    response: str,
    retrieved_contexts: List[Dict]
) -> float:
    """
    Use Gemini to evaluate hallucination using a claim-based approach.
    Score = (Number of unsupported claims) / (Total number of claims)
    """
    if not retrieved_contexts:
        return 0.5
        
    context_summary = "\n".join([
        f"- Q: {c.get('question', '')} A: {c.get('answer', '')}"
        for c in retrieved_contexts
    ])
    
    prompt = f"""Bạn là một chuyên gia kiểm định (Auditor) cho Chatbot RAG.
Nhiệm vụ: Phân tích và chấm điểm Hallucination dựa trên phương pháp bóc tách mệnh đề (Claim-based).

Context (Dữ liệu gốc):
{context_summary}

Chatbot Response (Câu trả lời cần kiểm tra):
{response}

Quy trình đánh giá:
1. Chia câu trả lời của chatbot thành các mệnh đề (claims) nhỏ, độc lập về thông tin.
   - Các câu xã giao (chào hỏi, mời gọi) KHÔNG tính là mệnh đề cần kiểm chứng.
   - Các thông tin về địa danh, sự kiện, con số, chỉ dẫn... LÀ mệnh đề cần kiểm chứng.
2. Đối soát từng mệnh đề với Context:
   - Mệnh đề được Context hỗ trợ trực tiếp hoặc gián tiếp logic: ✅ Hợp lệ.
   - Mệnh đề KHÔNG có trong Context hoặc SAI LỆCH hoàn toàn: ❌ Hallucination.
3. Tính toán:
   Hallucination Score = (Số mệnh đề ❌) / (Tổng số mệnh đề cần kiểm chứng)

Trả về kết quả theo cấu trúc JSON:
{{
  "total_claims": <số lượng mệnh đề cần kiểm chứng>,
  "unsupported_claims": <số lượng mệnh đề không được context hỗ trợ>,
  "score": <giá trị từ 0.0 đến 1.0>,
  "reason": "<giải thích ngắn gọn ví dụ: 'Bịa đặt thông tin về giờ mở cửa'> "
}}

Chỉ trả về JSON, không giải thích thêm."""

    try:
        # We use generate_json to get structured results
        result = await gemini_fast.generate_json(
            prompt=prompt,
            schema={
                "total_claims": "number",
                "unsupported_claims": "number",
                "score": "number",
                "reason": "string"
            }
        )
        
        score = result.get("score", 0.0)
        # Ensure score is within 0-1
        return min(max(float(score), 0.0), 1.0)
        
    except Exception as e:
        print(f"⚠️ LLM Claim-based check error: {e}")
        return -1.0 # Indicator to fallback to heuristic


async def evaluate_response(
    processing_state,
    output_state,
    start_time: float,
    session_id: str,
    chat_log_id: Optional[int] = None
) -> EvaluationMetrics:
    """
    Compute evaluation metrics for a response.
    
    Args:
        processing_state: MessageProcessingState with retrieved_context
        output_state: OutputState with response and model_used
        start_time: Time when processing started
        session_id: Current session ID
        chat_log_id: Optional reference to chat_logs entry
    
    Returns:
        EvaluationMetrics with all computed values
    """
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Get retrieved contexts
    contexts = getattr(processing_state, 'retrieved_context', []) or []
    
    # Average relevance score from retrieval
    avg_relevance = 0.0
    if contexts:
        scores = [ctx.get("score", 0.0) for ctx in contexts]
        avg_relevance = sum(scores) / len(scores)
    
    # Hallucination check
    response_text = getattr(output_state, 'response', '') or ''
    
    # Try LLM-based hallucination check
    hallucination = await compute_hallucination_score_llm(response_text, contexts)
    
    # Fallback to heuristic if LLM fails
    if hallucination < 0:
        hallucination = compute_hallucination_score_heuristic(response_text, contexts)
    
    metrics = EvaluationMetrics(
        response_latency_ms=latency_ms,
        context_relevance=round(avg_relevance, 3),
        context_count=len(contexts),
        model_used=getattr(output_state, 'model_used', 'unknown') or 'unknown',
        hallucination_score=hallucination,
        response_length=len(response_text)
    )
    
    # Store metrics to database
    await store_evaluation(metrics, session_id, chat_log_id)
    
    return metrics


async def store_evaluation(
    metrics: EvaluationMetrics,
    session_id: str,
    chat_log_id: Optional[int] = None
) -> bool:
    """Store evaluation metrics to Supabase"""
    client = get_supabase()
    if not client:
        print("⚠️ No Supabase client - skipping evaluation storage")
        return False
    
    try:
        client.table("model_evaluations").insert({
            "chat_log_id": chat_log_id,
            "session_id": session_id,
            "response_latency_ms": metrics.response_latency_ms,
            "context_relevance": metrics.context_relevance,
            "context_count": metrics.context_count,
            "model_used": metrics.model_used,
            "hallucination_score": metrics.hallucination_score,
            "response_length": metrics.response_length
        }).execute()
        return True
    except Exception as e:
        print(f"❌ Evaluation store error: {e}")
        return False


async def update_user_feedback(
    chat_log_id: int,
    feedback_score: int
) -> bool:
    """
    Update user feedback for a specific evaluation.
    
    Args:
        chat_log_id: Reference to the chat log entry
        feedback_score: -1 (negative), 0 (neutral), 1 (positive)
    """
    client = get_supabase()
    if not client:
        return False
    
    try:
        client.table("model_evaluations").update({
            "user_feedback_score": feedback_score
        }).eq("chat_log_id", chat_log_id).execute()
        return True
    except Exception as e:
        print(f"❌ Feedback update error: {e}")
        return False


async def get_model_stats(days: int = 7) -> Dict:
    """
    Get aggregated model statistics for the last N days.
    
    Returns:
        Dict with metrics per model per day
    """
    client = get_supabase()
    if not client:
        return {"error": "No Supabase client"}
    
    try:
        # Query the aggregated view
        response = client.rpc('get_model_stats', {'days': days}).execute()
        
        # Fallback to direct query if RPC not available
        if not response.data:
            response = client.table("model_evaluations").select(
                "model_used, response_latency_ms, context_relevance, "
                "hallucination_score, user_feedback_score"
            ).order("evaluated_at", desc=True).limit(100).execute()
            
            if response.data:
                # Manual aggregation
                stats = {}
                for row in response.data:
                    model = row.get("model_used", "unknown")
                    if model not in stats:
                        stats[model] = {
                            "count": 0,
                            "total_latency": 0,
                            "total_relevance": 0,
                            "total_hallucination": 0,
                            "feedback_positive": 0,
                            "feedback_negative": 0
                        }
                    stats[model]["count"] += 1
                    stats[model]["total_latency"] += row.get("response_latency_ms", 0)
                    stats[model]["total_relevance"] += row.get("context_relevance", 0)
                    stats[model]["total_hallucination"] += row.get("hallucination_score", 0)
                    
                    fb = row.get("user_feedback_score")
                    if fb == 1:
                        stats[model]["feedback_positive"] += 1
                    elif fb == -1:
                        stats[model]["feedback_negative"] += 1
                
                # Calculate averages
                for model, data in stats.items():
                    count = data["count"]
                    if count > 0:
                        data["avg_latency_ms"] = data["total_latency"] // count
                        data["avg_relevance"] = round(data["total_relevance"] / count, 3)
                        data["avg_hallucination"] = round(data["total_hallucination"] / count, 3)
                        total_fb = data["feedback_positive"] + data["feedback_negative"]
                        data["satisfaction_rate"] = round(
                            data["feedback_positive"] / total_fb, 2
                        ) if total_fb > 0 else None
                
                return stats
        
        return {"data": response.data}
    
    except Exception as e:
        print(f"❌ Stats error: {e}")
        return {"error": str(e)}
