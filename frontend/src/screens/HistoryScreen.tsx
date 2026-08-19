import { MapPin, Mic, Utensils } from "lucide-react";
import mascot from "../assets/mascot.svg";
import { Header } from "../components/Header";
import type { ConversationHistory } from "../types";

export function HistoryScreen({
  histories,
  onDetail,
  onDelete,
  onLogout,
  isGuest
}: {
  histories: ConversationHistory[];
  onDetail: (id: string) => void;
  onDelete: (id: string) => void;
  onLogout: () => void;
  isGuest?: boolean;
}) {
  return (
    <>
      <Header
        title="履歴一覧"
        right={
          <button type="button" onClick={onLogout}>
            ログアウト
          </button>
        }
      />
      {isGuest && <p className="history-guest-note">ゲストモードのため、この会話は保存されません（画面を離れると消えます）。</p>}
      <section className="history-list">
        {histories.map((history) => (
          <article className="soft-card history-card" key={history.id}>
            <span className="history-icon">
              {history.place.includes("飲食") ? <Utensils size={24} /> : history.place.includes("ライブ") ? <Mic size={24} /> : <MapPin size={24} />}
            </span>
            <div className="history-main">
              <h3>
                {history.date}
                <br />
                {history.place}
              </h3>
              <p>{history.overview}</p>
              {history.participants.length > 0 && <p className="history-participants">{history.participants.join("、")}</p>}
              <div className="history-actions">
                <button className="mini-button" type="button" onClick={() => onDetail(history.id)}>
                  詳細を見る
                </button>
                <button className="mini-button danger-text" type="button" onClick={() => onDelete(history.id)}>
                  削除
                </button>
              </div>
            </div>
          </article>
        ))}
        {histories.length === 0 && (
          <section className="soft-card empty-state">
            <img src={mascot} alt="" />
            <h2>履歴はまだありません</h2>
            <p>会話を記録すると、ここにまとめが表示されます。</p>
          </section>
        )}
      </section>
    </>
  );
}
