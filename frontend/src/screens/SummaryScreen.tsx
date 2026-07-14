import { Check } from "lucide-react";
import { Header } from "../components/Header";
import type { ConversationSummary } from "../types";

export function SummaryScreen({
  summary,
  onSave,
  onHistory,
  onTalk
}: {
  summary: ConversationSummary;
  onSave: () => void;
  onHistory: () => void;
  onTalk: () => void;
}) {
  return (
    <>
      <Header title="会話まとめ" />
      <div className="success-banner">
        <Check size={18} />
        <span>会話の記録が完了しました</span>
      </div>
      <SummaryCards summary={summary} />
      <div className="screen-action stack">
        <button className="button primary" type="button" onClick={onSave}>
          保存する
        </button>
        <button className="button secondary" type="button" onClick={onHistory}>
          履歴を見る
        </button>
        <button className="button secondary" type="button" onClick={onTalk}>
          もう一度会話する
        </button>
      </div>
    </>
  );
}

export function SummaryCards({ summary }: { summary: ConversationSummary }) {
  return (
    <section className="stack">
      <article className="soft-card card-pad summary-card">
        <h3>会話の要約</h3>
        <p>{summary.overview}</p>
      </article>
      <article className="soft-card card-pad summary-card">
        <h3>盛り上がった話題</h3>
        <ul>
          {summary.hotTopics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </article>
      <article className="soft-card card-pad summary-card">
        <h3>印象に残った内容</h3>
        <p>{summary.memorable}</p>
      </article>
    </section>
  );
}
