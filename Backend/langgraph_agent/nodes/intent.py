from dataclasses import dataclass
from pathlib import Path
from typing import Tuple, List, Optional

import numpy as np
import onnxruntime as ort
import yaml
import os
from transformers import AutoTokenizer

from ..state import MessageProcessingState, IntentType
from ..utils.gemini_client import gemini_fast
from .location_extractor import VNAdministrativeManager


_CONFIG_PATH = Path(__file__).resolve().parent.parent / "configs" / "intent.yaml"

try:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f) or {}
except Exception as e:
    print(f"⚠️ Error loading intent config: {e}")
    _config = {}

_model_cfg = _config.get("model", {})
_MODEL_DIR = Path(__file__).resolve().parents[2] / _model_cfg.get(
    "path", "model/IntentDetection/onnx-int8"
)
_MAX_LENGTH: int = _model_cfg.get("max_length", 128)
_CONFIDENCE_THRESHOLD: float = _model_cfg.get("confidence_threshold", 0.6)
_DEFAULT_INTENT: str = _model_cfg.get("default_intent", "place_exploration")

# Map model output id → Intent string (must match Enum names)
# Model labels: 0: accommodation, 1: budget_query, 2: chit_chat, 3: food_recommendation, 4: itinerary_request, 5: negative_feedback, 6: preference_update, 7: travel_query
_ID2LABEL = {
    0: "accommodation",
    1: "budget_info",
    2: "chit_chat",
    3: "food_drink",
    4: "itinerary_planning",
    5: "negative_feedback",
    6: "preference_update",
    7: "place_exploration"
}


@dataclass
class _PredictionResult:
    label: str
    confidence: float
    all_scores: dict[str, float]


class IntentDetector:
    _instance: Optional["IntentDetector"] = None

    def __init__(self, model_dir: str | Path = _MODEL_DIR) -> None:
        model_dir = Path(model_dir)
        # Priority to quantized model
        onnx_files = list(model_dir.glob("*_quantized.onnx")) or list(model_dir.glob("*.onnx"))
        if not onnx_files:
            raise FileNotFoundError(f"No .onnx file found in {model_dir}")

        print(f"Loading Intent ONNX model from {onnx_files[0]}")
        self._tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        self._session = ort.InferenceSession(
            str(onnx_files[0]),
            providers=["CPUExecutionProvider"],
        )
        self._input_names = [inp.name for inp in self._session.get_inputs()]
        print(f"✅ IntentDetector loaded ({onnx_files[0].name})")

    @classmethod
    def get(cls) -> "IntentDetector":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def predict(self, text: str) -> _PredictionResult:
        tokens = self._tokenizer(
            text,
            return_tensors="np",
            truncation=True,
            max_length=_MAX_LENGTH,
            padding=True,
        )
        ort_inputs = {k: v for k, v in tokens.items() if k in self._input_names}
        logits: np.ndarray = self._session.run(None, ort_inputs)[0][0]

        # Softmax
        exp = np.exp(logits - np.max(logits))
        probs = exp / exp.sum()

        pred_id = int(np.argmax(probs))
        label = _ID2LABEL[pred_id]

        return _PredictionResult(
            label=label,
            confidence=float(probs[pred_id]),
            all_scores={_ID2LABEL[i]: float(p) for i, p in enumerate(probs)},
        )


async def analyze_intent_with_llm(
    message: str, 
    history: List[dict] = None, 
    model_mode: str = "gemini"
) -> Tuple[IntentType, Optional[str]]:
    """
    Stricter LLM-based classification and location extraction.
    Returns (IntentType, location_name).
    """
    categories = [intent.value for intent in IntentType]
    
    # Build history context
    context = ""
    if history and len(history) > 0:
        turns = []
        for h in history[-3:]: # Last 3 turns for context
            role = "User" if h.get("role") == "user" else "Bot"
            turns.append(f"{role}: {h.get('content', '')}")
        context = "\nLịch sử hội thoại:\n" + "\n".join(turns)
    
    prompt = f"""Phân loại tin nhắn của người dùng cho chatbot du lịch Việt Nam vào MỘT trong các category sau:
- place_exploration: Hỏi về thông tin địa điểm tham quan, danh lam thắng cảnh, cảnh đẹp.
- history_culture: Hỏi về lịch sử, nguồn gốc, thông tin văn hóa của địa danh.
- budget_info: Hỏi về giá vé, chi phí dịch vụ, tiền bạc.
- opening_hours: Hỏi về giờ mở cửa, thời gian hoạt động.
- food_drink: Hỏi về đặc sản, quán ăn, ẩm thực, ăn uống.
- transportation: Hỏi về cách di chuyển, phương tiện (máy bay, tàu, xe), đường đi.
- itinerary_planning: Yêu cầu lên lịch trình, đề xuất thứ tự đi các điểm.
- accommodation: Hỏi về khách sạn, resort, chỗ ở.
- chit_chat: Chào hỏi, cảm ơn, tán gẫu không có nội dung du lịch cụ thể.
- negative_feedback: Phàn nàn, chê bai, không hài lòng.
- preference_update: Cập nhật sở thích (vd: "Tôi thích đi biển").
- unrelated: Không liên quan đến du lịch Việt Nam (hỏi code, toán, chính trị, nước khác).

QUY TẮC:
1. Nếu là tourism query, hãy trích xuất tên ĐỊA ĐIỂM cụ thể nhất được nhắc đến (vd: "Hà Nội", "Hội An", "Bà Nà Hills"). Nếu không có địa điểm cụ thể, để null.
2. Trả về JSON chính xác.

Trích xuất JSON:
{{
  "intent": "tên_category",
  "location": "tên_địa_điểm_nếu_có_hoặc_null",
  "reason": "giải thích ngắn gọn"
}}

Tin nhắn: "{message}"
{context}"""

    try:
        if model_mode == "qwen":
            from ..utils.system_state import get_use_llama
            client = None
            if get_use_llama():
                from ..utils.llama_client import llama_client
                client = llama_client
            else:
                from ..utils.qwen_client import qwen_client
                client = qwen_client
            
            # Using a simple prompt for now as classify helper might not support JSON schema easily
            # But let's assume we want a robust result.
            response_text = await client.generate(prompt, temperature=0.1)
            # Simple parse if not JSON
            import json
            try:
                data = json.loads(response_text)
            except:
                # Fallback simple parsing
                data = {"intent": "place_exploration", "location": None}
                for cat in categories:
                    if cat in response_text.lower():
                        data["intent"] = cat
                        break
        else:
            data = await gemini_fast.generate_json(prompt, schema={
                "type": "object",
                "properties": {
                    "intent": {"type": "string"},
                    "location": {"type": "string", "nullable": True},
                    "reason": {"type": "string"}
                },
                "required": ["intent"]
            })
        
        intent_str = data.get("intent", "place_exploration")
        location = data.get("location")
        
        # Map string back to enum
        final_intent = IntentType.PLACE_EXPLORATION
        for i in IntentType:
            if i.value == intent_str:
                final_intent = i
                break
        
        return final_intent, location
        
    except Exception as e:
        print(f"⚠️ Intent LLM error: {e}")
        return IntentType.PLACE_EXPLORATION, None


async def classify_intent(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Classify user intent and extract location.
    """
    # Force use LLM for now as per user request for "stronger" and location extraction
    # The ONNX model might be too simple for complex blocking + location extraction
    intent, location = await analyze_intent_with_llm(
        message=state.message,
        history=state.history,
        model_mode=state.model_mode
    )
    
    # NORMALIZE: Use administrative manager to get official name (e.g., "TP. Đà Nẵng")
    if location:
        try:
            admin_manager = VNAdministrativeManager()
            
            # Check if it's a province
            prov = admin_manager.find_province(location)
            if prov:
                normalized = prov["name"]
                print(f"📍 Normalized Province: {location} -> {normalized}")
                location = normalized
            else:
                # Keep the landmark name as is for exact matching in search
                print(f"📍 Detected Landmark: {location}")
                # We don't discard it anymore!
        except Exception as e:
            print(f"⚠️ Metadata normalization error: {e}")

    state.intent = intent
    state.detected_location = location
    state.intent_confidence = 0.9
    
    print(f"🎯 Intent: {intent.value} | Location: {location}")
    
    return state
