---
title: VendorCenter AI Assistant
emoji: 🔧
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: apache-2.0
app_port: 7860
---

# VendorCenter AI Assistant

Fine-tuned Llama-3.2-3B model for local service vendor discovery and booking assistance.

## API

This Space exposes an OpenAI-compatible API at `/v1/chat/completions`.

### Example

```bash
curl -X POST https://YOUR-SPACE.hf.space/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "system", "content": "You are VendorCenter'\''s AI assistant..."},
      {"role": "user", "content": "I need a plumber near me"}
    ],
    "max_tokens": 256,
    "temperature": 0.1
  }'
```

## Setup

1. Fine-tune with the Colab notebook (`model/notebooks/finetune_vendorcenter.ipynb`)
2. Upload GGUF to HuggingFace Hub
3. Update `MODEL_REPO` and `MODEL_FILE` in the Dockerfile
4. Create a new HF Space with Docker SDK and push these files
5. Set `SELF_HOSTED_LLM_URL=https://YOUR-SPACE.hf.space` on Railway backend
