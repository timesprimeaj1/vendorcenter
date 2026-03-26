#!/bin/bash
# Download GGUF model from HuggingFace Hub
set -e

if [ -f /app/model.gguf ]; then
  echo "Model already downloaded."
  exit 0
fi

echo "Downloading model from ${MODEL_REPO}/${MODEL_FILE}..."
python3 -c "
from huggingface_hub import hf_hub_download
import os
path = hf_hub_download(
    repo_id=os.environ['MODEL_REPO'],
    filename=os.environ['MODEL_FILE'],
    local_dir='/app',
    local_dir_use_symlinks=False,
)
import shutil
shutil.move(path, '/app/model.gguf')
print(f'Model saved to /app/model.gguf')
"
