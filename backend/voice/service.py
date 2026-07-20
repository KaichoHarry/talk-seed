# backend/voice/service.py
import asyncio
import base64

import edge_tts
import whisper

_model = None

VOICE_PROFILES = {
    "female": {"voice": "ja-JP-NanamiNeural", "rate": "+0%", "pitch": "+0Hz"},
    "male": {"voice": "ja-JP-KeitaNeural", "rate": "+0%", "pitch": "+0Hz"},
    # 男性音声を土台に低ピッチ+一定速化してロボットらしさを出す(edge-ttsにロボット専用ボイスは無いため)
    "robot": {"voice": "ja-JP-KeitaNeural", "rate": "-15%", "pitch": "-45Hz"},
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


async def _synthesize(text: str, voice_name: str, rate: str, pitch: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice_name, rate=rate, pitch=pitch)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data


def synthesize_speech(text: str, voice_type: str = "female") -> str:
    """テキストをedge-ttsで音声化し、base64文字列(mp3)で返す"""
    profile = VOICE_PROFILES.get(voice_type, VOICE_PROFILES["female"])
    audio_bytes = asyncio.run(
        _synthesize(text, profile["voice"], profile["rate"], profile["pitch"])
    )
    return base64.b64encode(audio_bytes).decode("utf-8")
