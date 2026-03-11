# Possible states: RUNNING, MAINTENANCE, ERROR, DRAINING
_APP_STATE = "RUNNING"

# LLM backend mode: False = Unsloth (GPU heavy), True = llama.cpp (VRAM light)
_USE_LLAMA = False

def get_app_state() -> str:
    global _APP_STATE
    return _APP_STATE

def set_app_state(state: str) -> None:
    global _APP_STATE
    print(f"🔄 System state changed to: {state}")
    _APP_STATE = state

def get_use_llama() -> bool:
    global _USE_LLAMA
    return _USE_LLAMA

def set_use_llama(enabled: bool) -> None:
    global _USE_LLAMA
    _USE_LLAMA = enabled
    backend = "llama.cpp (GGUF)" if enabled else "Unsloth (GPU)"
    print(f"🔄 LLM backend: {backend}")
