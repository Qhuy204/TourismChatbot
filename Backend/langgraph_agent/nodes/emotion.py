from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import onnxruntime as ort
import yaml
from transformers import AutoTokenizer

from ..state import EmotionType, MessageProcessingState



_CONFIG_PATH = Path(__file__).resolve().parent.parent / "configs" / "emotion.yaml"

try:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as _f:
        _config = yaml.safe_load(_f) or {}
except Exception as _e:
    print(f"⚠️ Error loading emotion config: {_e}")
    _config = {}

_model_cfg = _config.get("model", {})

# Resolve model path relative to Backend/
_MODEL_DIR = Path(__file__).resolve().parents[2] / _model_cfg.get(
    "path", "model/EmotionDetection/onnx-int8"
)
_MAX_LENGTH: int = _model_cfg.get("max_length", 128)
_CONFIDENCE_THRESHOLD: float = _model_cfg.get("confidence_threshold", 0.4)
_DEFAULT_EMOTION: str = _model_cfg.get("default_emotion", "neutral")

# Map model output id → EmotionType
_ID2LABEL = {0: "positive", 1: "negative", 2: "surprise", 3: "neutral"}


# Singleton Detector
@dataclass
class _PredictionResult:
    label: str
    confidence: float
    all_scores: dict[str, float]


class EmotionDetector:

    _instance: Optional["EmotionDetector"] = None

    def __init__(self, model_dir: str | Path = _MODEL_DIR) -> None:
        model_dir = Path(model_dir)
        onnx_files = list(model_dir.glob("*.onnx"))
        if not onnx_files:
            raise FileNotFoundError(f"No .onnx file found in {model_dir}")

        self._tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        self._session = ort.InferenceSession(
            str(onnx_files[0]),
            providers=["CPUExecutionProvider"],
        )
        self._input_names = [inp.name for inp in self._session.get_inputs()]
        print(f"✅ EmotionDetector loaded ({onnx_files[0].name})")

    # class-level singleton access 
    @classmethod
    def get(cls) -> "EmotionDetector":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    # inference
    def predict(self, text: str) -> _PredictionResult:
        """Run emotion inference on a single text. ~5-10 ms on CPU."""
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


# LangGraph Node

async def detect_emotion(state: MessageProcessingState) -> MessageProcessingState:
    try:
        detector = EmotionDetector.get()
        result = detector.predict(state.message)

        # Map label → EmotionType enum
        try:
            emotion = EmotionType(result.label)
        except ValueError:
            emotion = EmotionType.NEUTRAL

        confidence = result.confidence

        # Fall back to neutral if confidence is too low
        if confidence < _CONFIDENCE_THRESHOLD:
            emotion = EmotionType(_DEFAULT_EMOTION)

    except Exception as e:
        print(f"⚠️ Emotion detection error: {e}")
        emotion = EmotionType.NEUTRAL
        confidence = 0.0

    state.emotion = emotion
    state.emotion_confidence = confidence
    return state
