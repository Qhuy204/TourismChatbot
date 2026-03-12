import os
import json
import subprocess
import signal
import time
import asyncio
import httpx
from typing import Optional, List, AsyncIterator

# Paths
LLAMA_SERVER_BIN = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "llama.cpp", "build", "bin", "llama-server"
)
MODEL_GGUF = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "model", "Qwen3.5-9B", "Qwen3.5-9B.Q4_K_M.gguf"
)
MMPROJ_GGUF = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "model", "Qwen3.5-9B", "mmproj-f16.gguf"
)

LLAMA_HOST = "127.0.0.1"
LLAMA_PORT = 8081  # Separate port from FastAPI (8000)
LLAMA_BASE_URL = f"http://{LLAMA_HOST}:{LLAMA_PORT}"

_server_process: Optional[subprocess.Popen] = None


def start_llama_server(
    n_gpu_layers: int = 99,
    ctx_size: int = 12288,
    n_parallel: int = 1,
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
    _server_process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    # Wait for server to be ready (poll /health)
    max_wait = 120  # seconds
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

        http = self._get_http()
        resp = await http.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()

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
