FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir piper-tts==1.3.0 flask==3.0.3 gunicorn==22.0.0

# Voces en español (se descargan una sola vez al construir la imagen)
ARG VOICES_URL=https://huggingface.co/rhasspy/piper-voices/resolve/main/es
RUN mkdir -p /voices && cd /voices \
    && for v in es_AR/daniela/high/es_AR-daniela-high es_MX/claude/high/es_MX-claude-high; do \
         f=$(basename "$v"); \
         curl -fL -o "$f.onnx" "$VOICES_URL/$v.onnx" && curl -fL -o "$f.onnx.json" "$VOICES_URL/$v.onnx.json"; \
       done

COPY server.py .
EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "-w", "1", "--threads", "4", "--timeout", "120", "server:app"]
