import whisper

print("Whisperモデルを読み込み中...")

model = whisper.load_model("base")

print("読み込み完了")


def transcribe(filepath):

    result = model.transcribe(
        filepath,
        language="ja"
    )

    return result["text"].strip()