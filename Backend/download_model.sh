#!/bin/bash

# Configuration
REPO_ID="Qwen/Qwen3-VL-8B-Instruct-GGUF"
MODEL_FILE="Qwen3VL-8B-Instruct-Q4_K_M.gguf"
MMPROJ_FILE="mmproj-Qwen3VL-8B-Instruct-F16.gguf"
DEST_DIR="./model/Qwen3-VL8B-normal"

# Create destination directory if not exists
mkdir -p "$DEST_DIR"

echo "🚀 Starting download from HuggingFace: $REPO_ID"

# Check if huggingface-cli is installed
if ! command -v huggingface-cli &> /dev/null
then
    echo "⚠️ huggingface-cli not found. Installing..."
    pip install huggingface_hub
fi

# Download Model
echo "📥 Downloading model weights ($MODEL_FILE)..."
huggingface-cli download "$REPO_ID" "$MODEL_FILE" --local-dir "$DEST_DIR" --local-dir-use-symlinks False

# Download MMProj (Vision Encoder)
echo "📥 Downloading vision encoder ($MMPROJ_FILE)..."
huggingface-cli download "$REPO_ID" "$MMPROJ_FILE" --local-dir "$DEST_DIR" --local-dir-use-symlinks False

echo "✅ All files downloaded to $DEST_DIR"

# List files to verify
ls -lh "$DEST_DIR"
