import os
import re
import json
from typing import Optional, Dict, Any, List
from tenacity import retry, stop_after_attempt, wait_exponential

# Lazy import to avoid loading at module level
_genai = None
_client = None

# Model names
TEXT_MODEL = "gemini-3-flash-preview"  
PRO_MODEL = "gemini-3-flash-preview"   


def _get_client():
    """Lazy initialization of Gemini client"""
    global _genai, _client
    
    if _client is None:
        from google import genai
        from dotenv import load_dotenv
        
        # Load .env if not already loaded
        load_dotenv()
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        _genai = genai
        _client = genai.Client(api_key=api_key)
    
    return _client


def _get_types():
    """Get genai types module"""
    from google.genai import types
    return types


try:
    from langsmith import traceable
except ImportError:
    # Fallback if langsmith not installed
    def traceable(func=None, **kwargs):
        if func is None: return lambda f: f
        return func

class GeminiClient:
    """
    Centralized Gemini API wrapper.
    All LLM calls go through this client.
    """
    
    def __init__(self, model_name: str = TEXT_MODEL):
        self.model_name = model_name
        self._client = None
    
    @property
    def client(self):
        if self._client is None:
            self._client = _get_client()
        return self._client

    @traceable(run_type="llm")
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 20480
    ) -> str:
        """Generate text completion"""
        types = _get_types()
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        if system_instruction:
            config.system_instruction = system_instruction
        
        # Wrap sync call in a thread to fully avoid blocking the async event loop!
        import asyncio
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model_name,
            contents=prompt,
            config=config
        )
        
        # Check for safety filters if response is empty
        if not response.text:
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'finish_reason') and candidate.finish_reason != 'STOP':
                    print(f"⚠️ Gemini blocked response. Reason: {candidate.finish_reason}")
                if hasattr(candidate, 'safety_ratings'):
                    print(f"🛡️ Safety ratings: {candidate.safety_ratings}")
            elif hasattr(response, 'prompt_feedback') and response.prompt_feedback:
                print(f"🚫 Prompt blocked. Feedback: {response.prompt_feedback}")
        return response.text or ""

    @traceable(run_type="llm")
    async def generate_stream(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 20480,
        image_urls: Optional[List[str]] = None
    ):
        """Generate text completion as a stream, with optional image inputs"""
        import asyncio
        import httpx
        import base64
        
        types = _get_types()
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        if system_instruction:
            config.system_instruction = system_instruction
        
        # Build contents: combine images and text
        contents = []
        
        # Add images first (if any)
        if image_urls:
            for url in image_urls:
                try:
                    # For data URLs (base64), extract and use inline_data
                    if url.startswith("data:"):
                        # Parse data URL: data:image/jpeg;base64,/9j/4AAQ...
                        match = re.match(r"data:([^;]+);base64,(.+)", url)
                        if match:
                            mime_type = match.group(1)
                            b64_data = match.group(2)
                            contents.append(types.Part.from_bytes(
                                data=base64.b64decode(b64_data),
                                mime_type=mime_type
                            ))
                            print(f"📷 Added inline image ({mime_type})")
                    else:
                        # For HTTP URLs, download and convert to bytes
                        async with httpx.AsyncClient(timeout=5.0) as client:
                            resp = await client.get(url)
                            if resp.status_code == 200:
                                content_type = resp.headers.get("content-type", "image/jpeg")
                                contents.append(types.Part.from_bytes(
                                    data=resp.content,
                                    mime_type=content_type.split(";")[0]
                                ))
                                print(f"📷 Added image from URL: {url[:50]}...")
                except Exception as e:
                    print(f"⚠️ Failed to load image {url[:50]}: {e}")
        
        # Add text prompt
        contents.append(prompt)
        
        # Use threaded iteration to prevent blocking between chunks
        def get_stream():
            return self.client.models.generate_content_stream(
                model=self.model_name,
                contents=contents,
                config=config
            )
            
        import asyncio
        response_stream = await asyncio.to_thread(get_stream)
        iterator = iter(response_stream)
        
        while True:
            # Fetch next chunk in a separate thread.
            # We catch StopIteration INSIDE the threaded function to avoid leaking it to asyncio
            def get_next():
                try:
                    return next(iterator)
                except StopIteration:
                    return None
            
            chunk = await asyncio.to_thread(get_next)
            if chunk is None:
                break
                
            if chunk.text:
                yield chunk.text
    
    def generate_sync(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 20480
    ) -> str:
        """Synchronous version for simpler use cases"""
        types = _get_types()
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        if system_instruction:
            config.system_instruction = system_instruction
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config
        )
        
        return response.text or ""
    
    @traceable(run_type="llm")
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    async def generate_json(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.3,
        max_tokens: int = 4096  # Higher limit since gemini-3 generates <thought>
    ) -> Dict[str, Any]:
        """Generate structured JSON output natively using Gemini API"""
        types = _get_types()
        
        # Build config
        config_kwargs = {
            "temperature": temperature,
            "max_output_tokens": max_tokens,
            "response_mime_type": "application/json",
        }
        
        # ONLY add response_schema if it's a valid Schema object or a complex dict
        # Simplified dicts like {"key": "type"} cause ValidationErrors in the new SDK
        if schema and isinstance(schema, dict) and "type" in schema:
            config_kwargs["response_schema"] = schema
            
        config = types.GenerateContentConfig(**config_kwargs)
        
        import asyncio
        response = await asyncio.to_thread(
            self.client.models.generate_content,
            model=self.model_name,
            contents=prompt,
            config=config
        )
        
        if not response.text:
            return {}
            
        clean_text = response.text.strip()
        
        # 1. Remove <thought> blocks (gemini-3 specific quirk)
        # Use a more aggressive regex for nested or multiple thought blocks
        clean_text = re.sub(r"<thought>.*?</thought>", "", clean_text, flags=re.DOTALL).strip()
        
        # 2. Clean markdown code blocks
        if "```" in clean_text:
            # Extract content between ```json and ``` or just ``` and ```
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", clean_text, re.DOTALL)
            if match:
                clean_text = match.group(1).strip()
            else:
                clean_text = re.sub(r"```(?:json)?\s*", "", clean_text)
                clean_text = re.sub(r"\s*```", "", clean_text).strip()
        
        try:
            return json.loads(clean_text)
        except json.JSONDecodeError as dec_err:
            try:
                # 3. Extract JSON object/array via indices if direct parse fails
                first_curly = clean_text.find("{")
                last_curly = clean_text.rfind("}")
                first_square = clean_text.find("[")
                last_square = clean_text.rfind("]")
                
                start_idx = -1
                end_idx = -1
                
                if first_curly != -1 and (first_square == -1 or first_curly < first_square):
                    start_idx = first_curly
                    end_idx = last_curly
                elif first_square != -1:
                    start_idx = first_square
                    end_idx = last_square
                
                if start_idx != -1:
                    # If end_idx is -1 or before start_idx, the JSON is likely truncated
                    if end_idx <= start_idx:
                        # Attempt to fix truncated JSON by closing brackets
                        json_str = clean_text[start_idx:]
                        
                        # Fix unterminated strings: close any open quotes
                        # Count unescaped quotes
                        quote_count = len(re.findall(r'(?<!\\)"', json_str))
                        if quote_count % 2 != 0:
                            # Remove everything after the last complete key-value pair
                            # Find last complete entry (ending with } or ,)
                            last_good = max(
                                json_str.rfind('"},'),
                                json_str.rfind('"}'),
                                json_str.rfind('" }'),
                            )
                            if last_good > 0:
                                json_str = json_str[:last_good + 2]  # Include the }
                            else:
                                # Just close the dangling quote and trim
                                json_str = json_str.rstrip()
                                json_str += '"'
                        
                        # Clean trailing junk like commas or partial keys
                        json_str = re.sub(r",\s*$", "", json_str)
                        json_str = re.sub(r",\s*\"[^\"]*$", "", json_str)
                        json_str = re.sub(r",\s*\{[^}]*$", "", json_str)
                        
                        open_braces = json_str.count("{") - json_str.count("}")
                        open_brackets = json_str.count("[") - json_str.count("]")
                        
                        json_str += "]" * open_brackets
                        json_str += "}" * open_braces
                        return json.loads(json_str)
                    else:
                        json_str = clean_text[start_idx:end_idx+1]
                        # Simple fix for trailing commas before closing braces/brackets
                        json_str = re.sub(r",\s*([\]}])", r"\1", json_str)
                        return json.loads(json_str)
            except Exception as e:
                print(f"⚠️ Last-ditch JSON fix failed: {e}")
                pass
                
            print(f"❌ Failed to parse JSON (err: {dec_err}). Raw output: {response.text[:200]}...")
            return {}
    
    async def classify(
        self,
        text: str,
        categories: List[str],
        system_instruction: Optional[str] = None
    ) -> str:
        """Classify text into one of the categories"""
        categories_str = ", ".join(categories)
        
        prompt = f"""Phân loại văn bản sau vào MỘT trong các category: {categories_str}

Văn bản: "{text}"

Chỉ trả về TÊN category, không giải thích."""
        
        response = await self.generate(
            prompt,
            system_instruction=system_instruction,
            temperature=0.1,
            max_tokens=200
        )
        
        result = response.strip().lower()
        
        # Validate result is in categories
        for cat in categories:
            if cat.lower() in result:
                return cat
        
        # Return first category as fallback
        return categories[0]


# Singleton instances for different use cases
gemini_fast = GeminiClient(TEXT_MODEL)  # For intent, emotion, rewrite
gemini_pro = GeminiClient(PRO_MODEL)    # For complex generation


async def test_connection() -> bool:
    """Test Gemini API connection"""
    try:
        response = await gemini_fast.generate("Say 'OK'", max_tokens=100)
        return response is not None and len(response.strip()) >= 0
    except Exception as e:
        print(f"Gemini connection failed: {e}")
        return False


def test_connection_sync() -> bool:
    """Sync test for Gemini API"""
    try:
        response = gemini_fast.generate_sync("Say 'OK'", max_tokens=100)
        return response is not None
    except Exception as e:
        print(f"Gemini connection failed: {e}")
        return False
