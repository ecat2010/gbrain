@echo off
title gbrain Embed Server - bge-small-zh
echo Starting llama-server with bge-small-zh embedding model...
"D:\llama-b9245-bin-win-cpu-x64\llama-server.exe" ^
  --model "D:\gbrain-master\bge-small-zh-v1.5-q4_k_m.gguf" ^
  --embeddings --pooling mean -c 512 --port 8080 --no-warmup --host 127.0.0.1

echo Server stopped.
pause
