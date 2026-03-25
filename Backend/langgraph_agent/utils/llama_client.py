import os
import json
import subprocess
import signal
import time
import asyncio
import httpx
from typing import Optional, List, AsyncIterator, Any

# Paths
LLAMA_SERVER_BIN = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "llama.cpp", "build", "bin", "llama-server"
)
MODEL_GGUF = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "model", "Qwen3-VL8B", "qwen3-vl-8b-instruct-q4_k_m.gguf"
)
MMPROJ_GGUF = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "model", "Qwen3-VL8B", "mmproj-f16.gguf"
)

LLAMA_HOST = "127.0.0.1"
LLAMA_PORT = 8081  # Separate port from FastAPI (8000)
LLAMA_BASE_URL = f"http://{LLAMA_HOST}:{LLAMA_PORT}"

_server_process: Optional[subprocess.Popen] = None


def start_llama_server(
    n_gpu_layers: int = 48,   
    ctx_size: int = 24000,     
    n_parallel: int = 2,
) -> subprocess.Popen:
    """Start llama-server as a subprocess."""
    global _server_process

    if _server_process is not None and _server_process.poll() is None:
        print("✅ llama-server already running")
        return _server_process

    cmd = [
        LLAMA_SERVER_BIN,
        "-m", MODEL_GGUF,
    ]
    
    if os.path.exists(MMPROJ_GGUF):
        cmd.extend(["--mmproj", MMPROJ_GGUF])
    else:
        print(f"⚠️ Vision model not found at {MMPROJ_GGUF}, starting without vision support.")

    cmd.extend([
        "--host", LLAMA_HOST,
        "--port", str(LLAMA_PORT),
        "-ngl", str(n_gpu_layers),
        "-c", str(ctx_size),
        "-np", str(n_parallel),
        "--temp", "0.7",
        "--top-p", "0.9",
        "--repeat-penalty", "1.1",
        "--no-mmap",
    ])

    print(f"🚀 Starting llama-server: {' '.join(cmd)}")
    print(f"   GPU layers: {n_gpu_layers}/36 | CPU layers: {36 - min(n_gpu_layers, 36)} | ctx: {ctx_size}")
    print(f"   Est. VRAM usage: ~{n_gpu_layers * 133 + 300} MiB (weights + KV cache)")
    
    # Ensure the build/bin dir is in LD_LIBRARY_PATH so libmtmd.so.0 is found
    _build_bin = os.path.dirname(LLAMA_SERVER_BIN)
    _env = os.environ.copy()
    _existing_ld = _env.get("LD_LIBRARY_PATH", "")
    _env["LD_LIBRARY_PATH"] = f"{_build_bin}:{_existing_ld}" if _existing_ld else _build_bin

    _server_process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=_env,
    )

    # Wait for server to be ready (poll /health)
    max_wait = 60  # seconds
    start = time.time()
    while time.time() - start < max_wait:
        try:
            import urllib.request
            resp = urllib.request.urlopen(f"{LLAMA_BASE_URL}/health", timeout=2)
            data = json.loads(resp.read())
            if data.get("status") == "ok":
                print(f"✅ llama-server ready in {time.time() - start:.1f}s")
                return _server_process
        except Exception:
            pass
        time.sleep(1)
        # Check if process died
        if _server_process.poll() is not None:
            stdout = _server_process.stdout.read() if _server_process.stdout else ""
            raise RuntimeError(f"llama-server exited early:\n{stdout}")

    raise TimeoutError(f"llama-server did not start within {max_wait}s")


def stop_llama_server() -> None:
    """Gracefully stop llama-server."""
    global _server_process
    if _server_process is not None and _server_process.poll() is None:
        print("🛑 Stopping llama-server...")
        _server_process.send_signal(signal.SIGTERM)
        try:
            _server_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            _server_process.kill()
        print("✅ llama-server stopped")
    _server_process = None


class LlamaClient:
    """
    Async HTTP client for llama-server's OpenAI-compatible API.
    Drop-in replacement for QwenClient's generate/stream_generate.
    """

    def __init__(self, base_url: str = LLAMA_BASE_URL) -> None:
        self.base_url = base_url
        self._http: Optional[httpx.AsyncClient] = None

    def _get_http(self) -> httpx.AsyncClient:
        if self._http is None or self._http.is_closed:
            self._http = httpx.AsyncClient(base_url=self.base_url, timeout=120.0)
        return self._http

    def _build_messages(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        image_urls: Optional[List[str]] = None,
    ) -> list:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})

        # Build user content
        if image_urls:
            content = []
            for url in image_urls:
                content.append({"type": "image_url", "image_url": {"url": url}})
            content.append({"type": "text", "text": prompt})
            messages.append({"role": "user", "content": content})
        else:
            messages.append({"role": "user", "content": prompt})

        return messages

    async def generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        role: str = "user",
        grammar: Optional[str] = None,
    ) -> str:
        """Non-streaming generation via /v1/chat/completions."""
        messages = self._build_messages(prompt, system_instruction)
        payload = {
            "messages": messages,
            "temperature": temperature,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
            "max_tokens": max_tokens,
            "n_predict": max_tokens,
            "stop": ["<|im_end|>"],
            "stream": False,
        }
        
        if grammar:
            payload["grammar"] = grammar

        http = self._get_http()
        resp = await http.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()

    async def generate_json(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1536,
        root_type: Optional[str] = None, # object or array
    ) -> dict | list:
        """Generate structured JSON using local model with GBNF grammar."""
        
        # Generic JSON grammar components
        obj_def = """object ::= "{" ws ( pair ( "," ws pair )* )? "}" ws
pair   ::= string ":" ws value
array  ::= "[" ws ( value ( "," ws value )* )? "]" ws
value  ::= object | array | string | number | "true" | "false" | "null"
string ::= "\"" ( [^"\\\x00-\x1F] | "\\" ( ["\\/bfnrt] | "u" [0-9a-fA-F]{4} ) )* "\"" ws
number ::= "-"? ([0-9] | [1-9] [0-9]*) ("." [0-9]+)? ([eE] [+-]? [0-9]+)? ws
ws     ::= [ \t\n\r]*"""

        # Determine the root based on prompt or parameter
        if not root_type:
            root_type = "object" if "{" in prompt or "object" in prompt.lower() else "array"
        
        json_grammar = f"root ::= {root_type}\n{obj_def}"
        
        # Suffix to help the model start
        start_char = "{" if root_type == "object" else "["
        json_prompt = prompt + f"\n\nJSON:\n{start_char}"
        
        try:
            response_text = await self.generate(
                prompt=json_prompt,
                system_instruction=system_instruction,
                temperature=temperature,
                max_tokens=max_tokens,
                grammar=json_grammar
            )
            
            # Prepend the missing start character if not already in result
            full_response = response_text.strip()
            if not full_response.startswith(start_char):
                full_response = start_char + full_response
            
            # Use robust parsing
            return self._parse_json_response(full_response)
        except Exception as e:
            print(f"❌ Llama generate_json error: {e}")
            return {}

    def _parse_json_response(self, text: str) -> dict | list:
        """Robustly parse JSON from local model output, handling common hallucinations."""
        if not text:
            return {}
            
        # 1. Basic cleanup
        clean_text = text.strip()
        
        # 2. Handle markdown blocks if the model ignored our "no backticks" rule
        if "```" in clean_text:
            import re
            match = re.search(r"```(?:json)?\s*(.*?)(?:```|$)", clean_text, re.DOTALL)
            if match:
                clean_text = match.group(1).strip()
        
        # 3. Aggressive search for JSON structure
        try:
            # Find the balanced boundaries for the first object or array
            # This helps skip preamble or trailing garbage
            first_brace = clean_text.find('{')
            first_bracket = clean_text.find('[')
            
            start_idx = -1
            if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
                start_idx = first_brace
                end_char = '}'
            elif first_bracket != -1:
                start_idx = first_bracket
                end_char = ']'
            
            if start_idx != -1:
                # Find the LAST matching end character
                end_idx = clean_text.rfind(end_char)
                if end_idx != -1:
                    clean_text = clean_text[start_idx : end_idx + 1]
        except Exception:
            pass

        # 4. Final attempt to parse with auto-closing of brackets/braces
        try:
            return json.loads(clean_text)
        except json.JSONDecodeError:
            # Try to fix truncated JSON by appending missing closing characters
            tmp_text = clean_text.strip()
            stack = []
            for char in tmp_text:
                if char == '{': stack.append('}')
                elif char == '[': stack.append(']')
                elif char == '}' and stack and stack[-1] == '}': stack.pop()
                elif char == ']' and stack and stack[-1] == ']': stack.pop()
            
            # Close in reverse order
            if stack:
                try:
                    # Try to close any open string first if it's truncated
                    fixed_text = tmp_text
                    if fixed_text.count('"') % 2 != 0:
                        fixed_text += '"'
                        
                    # Add missing closings
                    fixed_text += "".join(reversed(stack))
                    return json.loads(fixed_text)
                except:
                    pass
                
            print(f"⚠️ Llama JSON parse failed after cleanup: {clean_text[:100]}...")
            return {}

    async def stream_generate(
        self,
        prompt: str,
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        image_urls: Optional[List[str]] = None,
        role: str = "user",
    ) -> AsyncIterator[str]:
        """Streaming generation via /v1/chat/completions (SSE)."""
        messages = self._build_messages(prompt, system_instruction, image_urls)
        payload = {
            "messages": messages,
            "temperature": temperature,
            "top_p": 0.9,
            "repeat_penalty": 1.1,
            "max_tokens": max_tokens,
            "n_predict": max_tokens,
            "stop": ["<|im_end|>", "<|endoftext|>"],
            "stream": True,
        }

        http = self._get_http()
        print(f"🚀 LLAMA STREAMING: Starting request to /v1/chat/completions")
        async with http.stream("POST", "/v1/chat/completions", json=payload) as resp:
            resp.raise_for_status()
            chunk_count = 0
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    print(f"✅ LLAMA STREAMING: Done ({chunk_count} chunks)")
                    break
                try:
                    chunk = json.loads(data_str)
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        chunk_count += 1
                        if chunk_count == 1:
                            print(f"⚡ LLAMA STREAMING: First chunk received")
                        yield content
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue

    async def classify(
        self,
        text: str,
        categories: List[str],
        system_instruction: Optional[str] = None,
    ) -> str:
        """Classify text into one of the given categories."""
        categories_str = ", ".join(categories)
        prompt = f"""Phân loại văn bản sau vào MỘT trong các category: {categories_str}

Văn bản: "{text}"

Chỉ trả về TÊN category chính xác, không giải thích."""

        response = await self.generate(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=0.1,
            max_tokens=64,
        )

        result = response.strip().lower()
        for cat in categories:
            if cat.lower() in result:
                return cat
        return categories[0]

    async def close(self) -> None:
        if self._http and not self._http.is_closed:
            await self._http.aclose()


# Singleton
llama_client = LlamaClient()
