import numpy as np

from config import SILENCE_THRESHOLD


class SpeechBuffer:

    def __init__(self):
        self.frames = []
        self.is_recording = False
        self.silence_count = 0

    def add_frame(self, frame, speaking):
        """
        フレームを追加し、発話状態を更新する
        """

        if speaking:
            self.is_recording = True
            self.silence_count = 0
            self.frames.append(frame.copy())
            return False

        if self.is_recording:

            self.frames.append(frame.copy())
            self.silence_count += 1

            if self.silence_count >= SILENCE_THRESHOLD:
                return True

        return False

    def get_audio(self):

        if len(self.frames) == 0:
            return None

        return np.concatenate(self.frames, axis=0)

    def reset(self):

        self.frames.clear()
        self.is_recording = False
        self.silence_count = 0