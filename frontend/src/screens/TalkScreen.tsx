import { Bot, Circle, Mic, Pause, Play, Volume2 } from "lucide-react";
import { Header } from "../components/Header";
import type { MicState, RecordingState, SceneOption, Topic } from "../types";

export function TalkScreen({
  scene,
  topic,
  voiceStatus,
  recording,
  recordingSeconds,
  isLoading,
  micState,
  lastUserText,
  onToggleMic,
  onRead,
  onDeep,
  onNextTopic,
  onStartRecording,
  onPause,
  onEnd
}: {
  scene: SceneOption;
  topic: Topic;
  voiceStatus: string;
  recording: RecordingState;
  recordingSeconds: number;
  isLoading: boolean;
  micState: MicState;
  lastUserText: string;
  onToggleMic: () => void;
  onRead: () => void;
  onDeep: () => void;
  onNextTopic: () => void;
  onStartRecording: () => void;
  onPause: () => void;
  onEnd: () => void;
}) {
  const isRecording = recording !== "idle";
  const micLabel = micState === "recording" ? "話す内容を聞いています…" : micState === "processing" ? "AIが考えています…" : "ボタンを押して話しかける";

  return (
    <>
      <Header title="会話サポート" />
      <div className="scene-summary">
        {[scene.place, scene.relationship, scene.mood].map((value) => (
          <span className="summary-pill" key={value}>
            {value}
          </span>
        ))}
      </div>
      {isRecording && (
        <div className="recording-status is-visible">
          <Circle size={10} fill="currentColor" />
          <span>{recording === "paused" ? "一時停止中" : "REC"}</span>
          {recording === "recording" && <span>{formatTimer(recordingSeconds)}</span>}
        </div>
      )}
      <section className="soft-card topic-card">
        <div className="topic-kicker">
          <span>{topic.label}</span>
          <span className="assistant-bubble">
            <Bot size={19} />
          </span>
        </div>
        <p className="topic-text">{topic.text}</p>
        <div className="voice-status">
          <Volume2 size={18} />
          <span>{voiceStatus}</span>
        </div>
      </section>
      <section className="soft-card card-pad mic-panel">
        <p className="mic-status">{micLabel}</p>
        {lastUserText && <p className="mic-transcript">「{lastUserText}」</p>}
        <button
          className={`mic-button ${micState === "recording" ? "is-active" : ""}`}
          type="button"
          onClick={onToggleMic}
          disabled={micState === "processing"}
        >
          <Mic size={26} />
        </button>
      </section>
      <div className="screen-action stack">
        <div className="button-row">
          <button className="button secondary" type="button" onClick={onRead}>
            もう一度読む
          </button>
          <button className="button secondary" type="button" onClick={onDeep} disabled={isLoading}>
            {isLoading ? "取得中" : "深掘り質問"}
          </button>
        </div>
        <button className="button primary" type="button" onClick={onNextTopic} disabled={isLoading}>
          {isLoading ? "AI応答を取得中..." : "次の話題へ"}
        </button>
      </div>
      <section className="record-panel">
        <p className="privacy-note">録音する前に、相手の同意を得てください。録音禁止の場所では使用しないでください。</p>
        {!isRecording ? (
          <button className="button danger" type="button" onClick={onStartRecording}>
            会話を記録する
          </button>
        ) : (
          <div className="button-row">
            <button className="button secondary" type="button" onClick={onPause}>
              {recording === "paused" ? <Play size={16} /> : <Pause size={16} />}
              {recording === "paused" ? "再開" : "一時停止"}
            </button>
            <button className="button danger" type="button" onClick={onEnd} disabled={isLoading}>
              {isLoading ? "送信中..." : "記録を終了する"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
