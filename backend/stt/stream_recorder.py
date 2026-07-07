import queue
import sounddevice as sd

from config import SAMPLE_RATE, CHANNELS, FRAME_DURATION

# 音声データを保存するキュー
audio_queue = queue.Queue()


def audio_callback(indata, frames, time, status):
    """
    マイクから音声が入力されるたびに呼ばれるコールバック関数
    """

    if status:
        print(status)

    # 音声データをコピーしてキューに追加
    audio_queue.put(indata.copy())


def create_stream():
    """
    音声入力ストリームを作成する
    """

    # 30msごとの音声データを取得
    blocksize = int(SAMPLE_RATE * FRAME_DURATION / 1000)

    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="int16",
        blocksize=blocksize,
        callback=audio_callback,
    )

    return stream