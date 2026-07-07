import os

print("現在の作業ディレクトリ:", os.getcwd())

from stream_recorder import create_stream, audio_queue
from speech_buffer import SpeechBuffer
from vad import is_speech
from recorder import save_audio
from transcriber import transcribe

import time

stream = create_stream()
buffer = SpeechBuffer()

print("マイク起動")

stream.start()

print("話してください")

try:

    while True:

        if not audio_queue.empty():

            frame = audio_queue.get()

            speaking = is_speech(frame.tobytes())

            completed = buffer.add_frame(frame, speaking)

            if completed:

                print("🎤 発話終了")

                audio = buffer.get_audio()

                filename = save_audio(audio)

                text = transcribe(filename)

                print(f"\n認識結果：{text}")

                buffer.reset()

        time.sleep(0.01)

except KeyboardInterrupt:

    stream.stop()
    stream.close()

    print("終了")