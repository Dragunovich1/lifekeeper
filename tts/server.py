"""Servidor TTS local (Piper) para el asistente de LifeKeeper.

Corre en la red privada de Docker: el texto nunca sale del servidor.
"""
import io
import re
import wave

from flask import Flask, Response, jsonify, request
from piper import PiperVoice, SynthesisConfig

VOICES = {
    'female': '/voices/es_AR-daniela-high.onnx',
    'male': '/voices/es_MX-claude-high.onnx',
}
MAX_CHARS = 1500

app = Flask(__name__)
_loaded: dict[str, PiperVoice] = {}


def get_voice(key: str) -> PiperVoice:
    if key not in VOICES:
        key = 'female'
    if key not in _loaded:
        _loaded[key] = PiperVoice.load(VOICES[key])
    return _loaded[key]


def prepare_text(text: str) -> str:
    """Limpia el texto y convierte las risas escritas en algo pronunciable."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'[•#_*`~>]', ' ', text)
    text = re.sub(r'https?://\S+', '', text)
    # "jajaja", "jejeje", "jijiji", "jsjs" -> "¡Ja, ja, ja!"
    text = re.sub(
        r'\b(?:[jJ][aeiouAEIOU]){2,}[jJ]?\b|\b(?:[jJ][sS]){2,}\b',
        lambda m: '¡Ja, ja, ja!' if len(m.group(0)) >= 6 else '¡Ja, ja!',
        text,
    )
    text = re.sub(r'[\U0001F300-\U0001FAFF☀-➿]', '', text)
    return re.sub(r'[ \t]+', ' ', text).strip()


def split_sentences(text: str) -> list[str]:
    parts = re.findall(r'[^.!?¡¿\n]*[¡¿]?[^.!?\n]*(?:[.!?]+|\n|$)', text)
    return [p.strip() for p in parts if p and p.strip(' .!?¡¿')]


def style_for(sentence: str, speed: float) -> tuple[float, float, float]:
    """(length_scale, noise_scale, pausa_en_segundos) según la puntuación."""
    base = 1.0 / max(0.6, min(speed, 1.6))
    if sentence.endswith('!') or sentence.startswith('¡'):
        return base * 0.92, 0.8, 0.18
    if sentence.endswith('?') or sentence.startswith('¿'):
        return base * 0.97, 0.75, 0.22
    if sentence.endswith('...') or sentence.endswith('…'):
        return base * 1.12, 0.6, 0.4
    return base, 0.667, 0.3


@app.get('/health')
def health():
    return jsonify(ok=True, voices=list(VOICES))


@app.post('/speak')
def speak():
    body = request.get_json(silent=True) or {}
    text = prepare_text(str(body.get('text', '')))[:MAX_CHARS]
    if not text:
        return jsonify(error='texto vacío'), 400

    voice = get_voice(str(body.get('voice', 'female')))
    speed = float(body.get('speed', 1.0))

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(voice.config.sample_rate)
        for sentence in split_sentences(text):
            length, noise, pause = style_for(sentence, speed)
            cfg = SynthesisConfig(length_scale=length, noise_scale=noise, noise_w_scale=0.8)
            for chunk in voice.synthesize(sentence, syn_config=cfg):
                wav.writeframes(chunk.audio_int16_bytes)
            wav.writeframes(b'\x00\x00' * int(voice.config.sample_rate * pause))
    return Response(buf.getvalue(), mimetype='audio/wav')
