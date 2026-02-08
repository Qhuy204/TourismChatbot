import os
# Set Unsloth cache directory outside of the project to avoid infinite uvicorn reloads
os.environ["UNSLOTH_CACHE_DIR"] = os.path.expanduser("~/.cache/unsloth")

from unsloth import FastVisionModel
import torch
from typing import Optional, List, Dict, Any
from transformers import TextStreamer, TextIteratorStreamer
from threading import Thread

# Configuration
MODEL_PATH = "/home/qhuy/TourismChatbot/TourismChatbot/Backend/model/qwen3vl-viettravelvqa/checkpoint-220"

class QwenClient:
    """
    Client for local Qwen3 VL inference using Unsloth.
    Singleton pattern to avoid re-loading the large model.
    """
    _instance = None
    _model = None
    _processor = None
    _is_initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(QwenClient, cls).__new__(cls)
        return cls._instance

    def warm_load(self):
        """Public method to warm-load the model"""
        self._initialize()

    def _initialize(self):
        """Lazy initialization of the model"""
        if self._is_initialized:
            return

        print(f"⏳ Loading Qwen3 VL model from {MODEL_PATH}...")
        try:
            # For Vision models, Unsloth returns model and processor
            model, processor = FastVisionModel.from_pretrained(
                model_name=MODEL_PATH,
                load_in_4bit=True,
                device_map="auto",
            )
            FastVisionModel.for_inference(model)
            
            self._model = model
            self._processor = processor
            self._is_initialized = True
            print("✅ Qwen3 VL model loaded successfully")
        except Exception as e:
            print(f"❌ Failed to load Qwen3 VL model: {e}")
            raise

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """Generate text response"""
        if not self._is_initialized:
            self._initialize()

        # Build message structure - Qwen2-VL style
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": [{"type": "text", "text": system_instruction}]})
        
        # Current message
        messages.append({"role": "user", "content": [{"type": "text", "text": prompt}]})

        # Process with processor
        input_text = self._processor.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self._processor(
            text=[input_text],
            images=None,
            videos=None,
            padding=True,
            return_tensors="pt",
        ).to("cuda")

        with torch.inference_mode():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                use_cache=True,
            )

        # Extract only the new tokens
        input_length = inputs.input_ids.shape[1]
        generated_tokens = outputs[0][input_length:]
        response = self._processor.tokenizer.decode(generated_tokens, skip_special_tokens=True)
        
        return response.strip()

    async def stream_generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ):
        """Generate text response as a stream"""
        if not self._is_initialized:
            self._initialize()

        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": [{"type": "text", "text": system_instruction}]})
        messages.append({"role": "user", "content": [{"type": "text", "text": prompt}]})

        input_text = self._processor.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self._processor(
            text=[input_text],
            images=None,
            videos=None,
            padding=True,
            return_tensors="pt",
        ).to("cuda")

        streamer = TextIteratorStreamer(
            self._processor.tokenizer, 
            skip_prompt=True, 
            skip_special_tokens=True
        )

        generation_kwargs = dict(
            **inputs,
            streamer=streamer,
            max_new_tokens=max_tokens,
            temperature=temperature,
            do_sample=temperature > 0,
            use_cache=True,
        )

        # Run generation in a separate thread
        thread = Thread(target=self._model.generate, kwargs=generation_kwargs)
        thread.start()

        import asyncio
        # Yield from streamer
        for new_text in streamer:
            yield new_text
            await asyncio.sleep(0)  # Allow event loop to process

    async def classify(
        self,
        text: str,
        categories: List[str],
        system_instruction: Optional[str] = None
    ) -> str:
        """Classify text into categories using Qwen"""
        categories_str = ", ".join(categories)
        prompt = f"""Phân loại văn bản sau vào MỘT trong các category: {categories_str}

Văn bản: "{text}"

Chỉ trả về TÊN category chính xác, không giải thích."""
        
        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.1,
            max_tokens=64
        )
        
        result = response.strip().lower()
        # Find match in categories
        for cat in categories:
            if cat.lower() in result:
                return cat
        
        return categories[0]

# Singleton instance
qwen_client = QwenClient()

async def test_qwen_connection() -> bool:
    """Simple test to verify Qwen client is working"""
    try:
        response = await qwen_client.generate("Xin chào, bạn là ai?", max_tokens=20)
        return len(response) > 0
    except Exception as e:
        print(f"Qwen connection test failed: {e}")
        return False
