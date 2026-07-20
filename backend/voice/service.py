# backend/voice/service.py
import asyncio
import base64

import edge_tts
import whisper

_model = None

VOICE_MAP = {
    "female": "ja-JP-NanamiNeural",
    "male": "ja-JP-KeitaNeural",
    "robot": "ja-JP-KeitaNeural",
}


def _get_model():
    global _model
    if _model is None:
        print("Whisperモデルを読み込み中... (base)")
        _model = whisper.load_model("base")
        print("Whisperモデルの読み込み完了")
    return _model


def transcribe_audio_file(filepath: str) -> str:
    """音声ファイルをWhisperで日本語文字起こしする"""
    model = _get_model()
    result = model.transcribe(filepath, language="ja")
    return result["text"].strip()


async def _synthesize(text: str, voice_name: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice_name)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data


def synthesize_speech(text: str, voice_type: str = "female") -> str:
    """テキストをedge-ttsで音声化し、base64文字列(mp3)で返す"""
    voice_name = VOICE_MAP.get(voice_type, VOICE_MAP["female"])
    audio_bytes = asyncio.run(_synthesize(text, voice_name))
    return base64.b64encode(audio_bytes).decode("utf-8")
