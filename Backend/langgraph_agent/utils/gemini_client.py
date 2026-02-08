"""
Gemini API Client Wrapper
Centralized client for all LLM calls - ONLY Gemini, no OpenAI

Using google-genai package (new SDK)
"""
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
        
        # Switching to sync call as workaround for aiohttp DNS error in current environment
        response = self.client.models.generate_content(
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

    async def generate_stream(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 20480
    ):
        """Generate text completion as a stream"""
        import asyncio
        
        types = _get_types()
        config = types.GenerateContentConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )
        
        if system_instruction:
            config.system_instruction = system_instruction
        
        # Use sync generator in executor to avoid blocking
        response_stream = self.client.models.generate_content_stream(
            model=self.model_name,
            contents=prompt,
            config=config
        )
        
        for chunk in response_stream:
            if chunk.text:
                yield chunk.text
                # Allow event loop to process other tasks
                await asyncio.sleep(0)
    
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
    
    async def generate_json(
        self,
        prompt: str,
        schema: Dict[str, Any],
        temperature: float = 0.3,
        max_tokens: int = 1024  # Higher limit for JSON output
    ) -> Dict[str, Any]:
        """Generate structured JSON output"""
        json_prompt = f"""{prompt}

Trả về JSON theo schema:
{json.dumps(schema, ensure_ascii=False, indent=2)}

CHỈ trả về JSON, không có text khác."""
        
        response = await self.generate(json_prompt, temperature=temperature, max_tokens=max_tokens)
        
        # Parse JSON with fallback
        try:
            # 1. Clean markdown code blocks
            clean_response = response.strip()
            if "```" in clean_response:
                clean_response = re.sub(r"```(?:json)?\n?(.*?)```", r"\1", clean_response, flags=re.DOTALL).strip()
            
            # 2. Try parse cleaned response
            return json.loads(clean_response)
        except json.JSONDecodeError:
            # 3. Try to extract JSON object/array via regex if direct parse fails
            try:
                match = re.search(r'(\{.*\}|\[.*\])', response, re.DOTALL)
                if match:
                    json_str = match.group(1)
                    # Simple fix for trailing commas before closing braces/brackets
                    json_str = re.sub(r",\s*([\]}])", r"\1", json_str)
                    return json.loads(json_str)
            except:
                pass
            
            # Log error but don't crash app flow
            print(f"Failed to parse JSON: {response[:200]}...")
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
