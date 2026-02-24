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
from ..utils.qwen_client import qwen_client


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
_DEFAULT_INTENT: str = _model_cfg.get("default_intent", "travel_query")

# Map model output id → Intent string (must match Enum names)
# Model labels: 0: accommodation, 1: budget_query, 2: chit_chat, 3: food_recommendation, 4: itinerary_request, 5: negative_feedback, 6: preference_update, 7: travel_query
_ID2LABEL = {
    0: "accommodation",
    1: "budget_query",
    2: "chit_chat",
    3: "food_recommendation",
    4: "itinerary_request",
    5: "negative_feedback",
    6: "preference_update",
    7: "travel_query"
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


async def classify_by_llm(message: str, history: List[dict] = None, model_mode: str = "gemini") -> IntentType:
    """LLM-based classification for ambiguous cases"""
    categories = [intent.value for intent in IntentType]
    
    context = ""
    if history and len(history) > 0:
        last_turn = history[-1].get("content", "")[:100]
        context = f"\nContext (tin nhắn trước): {last_turn}"
    
    system_instruction = "Bạn là hệ thống phân loại intent cho chatbot du lịch Việt Nam."
    
    if model_mode == "qwen":
        result = await qwen_client.classify(
            text=f"{message}{context}",
            categories=categories,
            system_instruction=system_instruction
        )
    else:
        result = await gemini_fast.classify(
            text=f"{message}{context}",
            categories=categories,
            system_instruction=system_instruction
        )
    
    # Map string back to enum
    for intent in IntentType:
        if intent.value == result:
            return intent
    
    return IntentType.TRAVEL_QUERY


async def classify_intent(state: MessageProcessingState) -> MessageProcessingState:
    """
    LangGraph node: Classify user intent using PhoBERT ONNX model.
    Falls back to LLM if confidence is low.
    """
    try:
        detector = IntentDetector.get()
        result = detector.predict(state.message)
        
        confidence = result.confidence
        
        if confidence >= _CONFIDENCE_THRESHOLD:
            try:
                intent = IntentType(result.label)
            except ValueError:
                intent = IntentType.TRAVEL_QUERY
        else:
            # Fallback to LLM for low confidence or ambiguous cases
            intent = await classify_by_llm(
                message=state.message,
                history=state.history,
                model_mode=state.model_mode
            )
            confidence = 0.8  # LLM default confidence
            
    except Exception as e:
        print(f"⚠️ Intent detection error: {e}")
        # Crash-safe fallback to LLM
        try:
            intent = await classify_by_llm(
                message=state.message,
                history=state.history,
                model_mode=state.model_mode
            )
            confidence = 0.7
        except:
            intent = IntentType.TRAVEL_QUERY
            confidence = 0.5

    state.intent = intent
    state.intent_confidence = confidence
    
    return state
