# Hugging Face Spaces (Docker SDK) 用。
# バックエンド(Flask + Whisper + edge-tts + Gemini)のみをこのイメージで動かす。
# フロントエンド(React)はVercel等の別サービスにデプロイする想定。
FROM python:3.12-slim

# Whisperの音声デコードに必要
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt

# CPU専用のPyTorchを先に入れる(指定しないとGPU向けのCUDAライブラリ込み
# (数GB)がデフォルトで入り、ビルドが極端に重くなる。HF Spacesの無料枠はCPUのみ)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r backend/requirements.txt gunicorn

COPY backend/ backend/

# Hugging Face Spaces (Docker SDK) はデフォルトでポート7860を想定している
ENV PORT=7860
EXPOSE 7860

# 常時稼働のGunicornで起動する(開発用のFlask内蔵サーバーは使わない)。
# Whisperモデルはワーカーごとにメモリへロードされるため、メモリ節約のためワーカー数は1にしている。
# 初回リクエストでWhisperモデルのダウンロード・ロードが走るため、タイムアウトを長めに取っている。
CMD ["sh", "-c", "gunicorn -w 1 --threads 4 -b 0.0.0.0:${PORT} --timeout 180 backend.api.app:app"]
