import whisper

model = whisper.load_model("base")

result = model.transcribe(
    "test.wav",
    language="ja"
)

print(result["text"])