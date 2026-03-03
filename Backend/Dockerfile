# ──────────────────────────────────────────────
# ViVi Backend — FastAPI + LangGraph + GPU
# ──────────────────────────────────────────────
FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# ── System deps ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common build-essential git curl libgl1-mesa-glx libglib2.0-0 && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    python3.12 python3.12-venv python3.12-dev && \
    ln -sf /usr/bin/python3.12 /usr/bin/python && \
    ln -sf /usr/bin/python3.12 /usr/bin/python3 && \
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3.12 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Upgrade pip ──
RUN python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# ── Install Python deps (cached layer) ──
COPY requirements.txt .
RUN pip install torch==2.2.1+cu121 --index-url https://download.pytorch.org/whl/cu121 && \
    pip install -r requirements.txt

# ── Copy application code ──
COPY main.py .
COPY langgraph_agent/ ./langgraph_agent/

# ── Volumes (mounted at runtime) ──
# /app/model      → local AI models (Qwen3-VL, Emotion, Intent)
# /app/data       → ChromaDB vector store + admin divisions JSON
# /app/.env       → environment variables

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
