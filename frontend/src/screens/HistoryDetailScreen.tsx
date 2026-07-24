import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import type { ConversationHistory } from "../types";
import { SummaryCards } from "./SummaryScreen";

export function HistoryDetailScreen({
  history,
  onBack,
  onDelete,
  onSaveParticipants
}: {
  history: ConversationHistory;
  onBack: () => void;
  onDelete: () => void;
  onSaveParticipants: (names: string[]) => void;
}) {
  const [names, setNames] = useState<string[]>(history.participants.length > 0 ? history.participants : [""]);

  useEffect(() => {
    setNames(history.participants.length > 0 ? history.participants : [""]);
  }, [history.id, history.participants]);

  const updateName = (index: number, value: string) => {
    setNames((current) => current.map((name, i) => (i === index ? value : name)));
  };

  const addName = () => setNames((current) => [...current, ""]);

  const removeName = (index: number) => setNames((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));

  return (
    <>
      <Header title="履歴詳細" />
      <section className="stack history-detail">
        <dl className="meta-list">
          <div>
            <dt>日時</dt>
            <dd>{history.date}</dd>
          </div>
          <div>
            <dt>場所</dt>
            <dd>{history.place}</dd>
          </div>
          <div>
            <dt>関係性</dt>
            <dd>{history.relationship}</dd>
          </div>
        </dl>
        <article className="soft-card card-pad">
          <h3>そのときのメンバー</h3>
          <div className="participant-list">
            {names.map((name, index) => (
              <div className="participant-row" key={index}>
                <input
                  className="participant-input"
                  type="text"
                  value={name}
                  placeholder={`参加者の名前 ${index + 1}`}
                  onChange={(event) => updateName(index, event.currentTarget.value)}
                />
                {names.length > 1 && (
                  <button className="icon-button" type="button" aria-label="この参加者を削除" onClick={() => removeName(index)}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            <div className="button-row">
              <button className="button secondary participant-add" type="button" onClick={addName}>
                <Plus size={16} /> 参加者を追加
              </button>
              <button className="button secondary participant-add" type="button" onClick={() => onSaveParticipants(names)}>
                <Save size={16} /> 保存する
              </button>
            </div>
          </div>
        </article>
        <SummaryCards summary={history} />
      </section>
      <div className="screen-action button-row">
        <button className="button secondary" type="button" onClick={onBack}>
          戻る
        </button>
        <button className="button soft-danger" type="button" onClick={onDelete}>
          <Trash2 size={16} />
          この履歴を削除する
        </button>
      </div>
    </>
  );
}
