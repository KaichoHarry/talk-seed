import type { Dispatch, SetStateAction } from "react";
import { Check, Home, MapPin, Mic, Plus, Trash2, Utensils } from "lucide-react";
import { Header } from "../components/Header";
import type { SceneOption } from "../types";

const placeOptions = [
  { value: "飲食店", title: "飲食店での待ち時間", desc: "おすすめ料理やお店の話題へ", Icon: Utensils },
  { value: "ライブ会場", title: "ライブ・イベント会場", desc: "好きな曲や思い出を広げます", Icon: Mic },
  { value: "テーマパーク", title: "テーマパーク", desc: "乗りたいアトラクションを話題に", Icon: MapPin },
  { value: "イベント会場", title: "イベント会場", desc: "展示や人との出会いを話しやすく", Icon: Home },
  { value: "移動中", title: "その他の待ち時間", desc: "移動中や旅行中にも使えます", Icon: MapPin }
];

const relationshipOptions = ["友人", "恋人", "家族", "初対面", "グループ"];
const moodOptions = ["楽しく話したい", "落ち着いて話したい", "盛り上げたい", "深い話をしたい"];

export function SceneScreen({
  scene,
  setScene,
  participants,
  setParticipants,
  setupCompleted,
  onNext
}: {
  scene: SceneOption;
  setScene: Dispatch<SetStateAction<SceneOption>>;
  participants: string[];
  setParticipants: Dispatch<SetStateAction<string[]>>;
  setupCompleted: boolean;
  onNext: () => void;
}) {
  const updateParticipant = (index: number, value: string) => {
    setParticipants((current) => current.map((name, i) => (i === index ? value : name)));
  };

  const addParticipant = () => {
    setParticipants((current) => [...current, ""]);
  };

  const removeParticipant = (index: number) => {
    setParticipants((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  };

  return (
    <>
      <Header title="シーン選択" />
      <section className="page-intro">
        <h2>シーンを選択してください</h2>
        <p>AIが会話しやすい話題を考えるために、いまの状況を選びます。</p>
      </section>
      <h2 className="section-title">場所</h2>
      <div className="choice-list">
        {placeOptions.map(({ value, title, desc, Icon }) => (
          <button
            className="choice-card"
            type="button"
            key={value}
            aria-pressed={scene.place === value}
            onClick={() => setScene((current) => ({ ...current, place: value }))}
          >
            <span className="choice-icon">
              <Icon size={22} />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
            <span className="choice-mark">
              <Check size={18} />
            </span>
          </button>
        ))}
      </div>
      <ChoiceGroup title="関係性" values={relationshipOptions} selected={scene.relationship} onSelect={(relationship) => setScene((current) => ({ ...current, relationship }))} />
      <ChoiceGroup title="気分・目的" values={moodOptions} selected={scene.mood} onSelect={(mood) => setScene((current) => ({ ...current, mood }))} />
      <h2 className="section-title">一緒にいる相手の名前</h2>
      <p className="page-intro-note">わかる範囲で入力してください。あとから履歴画面で編集できます。</p>
      <div className="participant-list">
        {participants.map((name, index) => (
          <div className="participant-row" key={index}>
            <input
              className="participant-input"
              type="text"
              value={name}
              placeholder={`相手の名前 ${index + 1}`}
              onChange={(event) => updateParticipant(index, event.currentTarget.value)}
            />
            {participants.length > 1 && (
              <button className="icon-button" type="button" aria-label="この参加者を削除" onClick={() => removeParticipant(index)}>
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
        <button className="button secondary participant-add" type="button" onClick={addParticipant}>
          <Plus size={16} /> 参加者を追加
        </button>
      </div>
      <div className="screen-action">
        <button className="button primary" type="button" onClick={onNext}>
          {setupCompleted ? "保存して会話へ" : "次へ"}
        </button>
      </div>
    </>
  );
}

function ChoiceGroup({ title, values, selected, onSelect }: { title: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  return (
    <>
      <h2 className="section-title">{title}</h2>
      <div className="chip-grid">
        {values.map((value) => (
          <button className="chip" type="button" key={value} aria-pressed={selected === value} onClick={() => onSelect(value)}>
            {value}
          </button>
        ))}
      </div>
    </>
  );
}
