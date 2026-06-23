from recorder import record_audio
from transcriber import transcribe_audio

filepath = record_audio()

text = transcribe_audio(filepath)

print("\n認識結果")
print(text)