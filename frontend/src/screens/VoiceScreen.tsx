import type { Dispatch, SetStateAction } from "react";
import { Play } from "lucide-react";
import { Header } from "../components/Header";
import type { VoiceOption, VoiceType } from "../types";

export function VoiceScreen({
  voice,
  setVoice,
  setupCompleted,
  isSaving,
  onSave,
  onPreview
}: {
  voice: VoiceOption;
  setVoice: Dispatch<SetStateAction<VoiceOption>>;
  setupCompleted: boolean;
  isSaving: boolean;
  onSave: () => void;
  onPreview: () => void;
}) {
  return (
    <>
      <Header title="音声設定" />
      <section className="page-intro">
        <h2>音声の設定をしてください</h2>
        <p>会話中に聞きやすい音声を選びます。</p>
      </section>
      <section className="soft-card card-pad voice-panel">
        <h2 className="section-title">音声タイプ</h2>
        <div className="segmented">
          {[
            ["female", "女性音声"],
            ["male", "男性音声"],
            ["robot", "ロボット"]
          ].map(([type, label]) => (
            <button className="segment" type="button" key={type} aria-pressed={voice.type === type} onClick={() => setVoice((current) => ({ ...current, type: type as VoiceType }))}>
              {label}
            </button>
          ))}
        </div>
        <Range label="音量" value={voice.volume} min={0} max={100} suffix="%" onChange={(volume) => setVoice((current) => ({ ...current, volume }))} />
        <Range label="話速" value={voice.rate} min={50} max={180} suffix={voice.rate < 85 ? " ゆっくり" : voice.rate > 125 ? " はやめ" : " ふつう"} onChange={(rate) => setVoice((current) => ({ ...current, rate }))} />
        <div className="preview-card">
          <button className="play-button" type="button" aria-label="サンプルを再生" onClick={onPreview}>
            <Play size={22} fill="currentColor" />
          </button>
          <div>
            <strong>音声プレビュー</strong>
            <p>サンプルを再生する</p>
          </div>
        </div>
      </section>
      <div className="screen-action">
        <button className="button accent" type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "APIに接続中..." : setupCompleted ? "設定を保存" : "保存して会話をはじめる"}
        </button>
      </div>
    </>
  );
}

function Range({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="range-row">
      <span className="range-head">
        <span>{label}</span>
        <span>
          {value}
          {suffix}
        </span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} />
    </label>
  );
}
