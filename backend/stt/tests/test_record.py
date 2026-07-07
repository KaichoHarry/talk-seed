import sounddevice as sd
from scipy.io.wavfile import write

fs = 44100
seconds = 5

print("5秒間録音します。話してください。")

audio = sd.rec(
    int(seconds * fs),
    samplerate=fs,
    channels=1,
    dtype="int16"
)

sd.wait()

write("test.wav", fs, audio)

print("録音が完了しました。")