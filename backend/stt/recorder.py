import sounddevice as sd
from scipy.io.wavfile import write

SAMPLE_RATE = 16000

def record_audio(duration=5):
    print("録音開始")

    audio = sd.rec(
        int(duration * SAMPLE_RATE),
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="int16"
    )

    sd.wait()

    filename = "recordings/input.wav"

    write(filename, SAMPLE_RATE, audio)

    print("録音終了")

    return filename