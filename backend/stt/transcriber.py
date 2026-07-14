import whisper

print("Whisperモデルを読み込み中...")

model = whisper.load_model("small")

print("読み込み完了")


def transcribe(filepath):

    result = model.transcribe(
        filepath,
        language="ja",
        fp16=False,
        temperature=0
    )

    return result["text"].strip()