import webrtcvad

from config import SAMPLE_RATE, VAD_MODE

# VAD（Voice Activity Detection）の作成
vad = webrtcvad.Vad(VAD_MODE)


def is_speech(frame):
    """
    frame: 30ms分の音声データ(bytes)
    戻り値: 音声ならTrue、無音ならFalse
    """
    return vad.is_speech(frame, SAMPLE_RATE)