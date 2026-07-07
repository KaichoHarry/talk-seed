from pathlib import Path
from scipy.io.wavfile import write
from config import SAMPLE_RATE

# recorder.py と同じ場所を取得
BASE_DIR = Path(__file__).resolve().parent

# 保存先ディレクトリ
OUTPUT_DIR = BASE_DIR / "recordings"
OUTPUT_DIR.mkdir(exist_ok=True)

# 保存ファイル
OUTPUT_FILE = OUTPUT_DIR / "input.wav"


def save_audio(audio):
    """
    NumPy配列をWAVファイルとして保存する
    """
    write(str(OUTPUT_FILE), SAMPLE_RATE, audio)
    return str(OUTPUT_FILE)