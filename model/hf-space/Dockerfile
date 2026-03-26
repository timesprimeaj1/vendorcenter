# Stage 1: Build llama.cpp from source (CPU-only, low-memory)
FROM ubuntu:22.04 AS build

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential cmake git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 https://github.com/ggerganov/llama.cpp.git /llama.cpp

WORKDIR /llama.cpp
# Limit parallelism to -j2 to avoid OOMKilled on free-tier HF Spaces (16GB RAM)
RUN cmake -B build -DGGML_CUDA=OFF -DLLAMA_SERVER=ON -DCMAKE_BUILD_TYPE=Release && \
    cmake --build build --config Release --target llama-server -j2

# Stage 2: Runtime
FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates python3 python3-pip libgomp1 && \
    pip3 install --no-cache-dir huggingface_hub && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=build /llama.cpp/build/bin/llama-server /usr/local/bin/llama-server

# HuggingFace Spaces runs on port 7860
ENV PORT=7860

# Model config
ENV MODEL_REPO="timesprimeaj/vendorcenter-assistant-3b-gguf"
ENV MODEL_FILE="llama-3.2-3b-instruct.Q4_K_M.gguf"

WORKDIR /app

COPY download_model.sh /app/download_model.sh
RUN chmod +x /app/download_model.sh

EXPOSE ${PORT}

# Download model then start llama-server
CMD ["/bin/bash", "-c", "/app/download_model.sh && llama-server -m /app/model.gguf --host 0.0.0.0 --port ${PORT} -c 1024 -ngl 0 --chat-template llama3"]
