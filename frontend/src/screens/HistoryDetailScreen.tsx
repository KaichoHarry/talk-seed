import { Trash2 } from "lucide-react";
import { Header } from "../components/Header";
import type { ConversationHistory } from "../types";
import { SummaryCards } from "./SummaryScreen";

export function HistoryDetailScreen({ history, onBack, onDelete }: { history: ConversationHistory; onBack: () => void; onDelete: () => void }) {
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
        <SummaryCards summary={history} />
        <article className="soft-card card-pad">
          <h3>会話全文</h3>
          <p>{history.transcript.join("\n")}</p>
        </article>
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
