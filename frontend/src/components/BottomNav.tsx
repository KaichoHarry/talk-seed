import { Clock3, FileText, Home, MessageCircle, Settings } from "lucide-react";
import type { Screen } from "../types";

export function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
  const items: Array<{ key: Screen; label: string; Icon: typeof Home }> = [
    { key: "scene", label: "シーン", Icon: Home },
    { key: "talk", label: "会話", Icon: MessageCircle },
    { key: "summary", label: "まとめ", Icon: FileText },
    { key: "history", label: "履歴", Icon: Clock3 },
    { key: "voice", label: "設定", Icon: Settings }
  ];

  return (
    <nav className="bottom-nav" aria-label="下部ナビゲーション">
      {items.map(({ key, label, Icon }) => {
        const current = screen === key || (screen === "detail" && key === "history");
        return (
          <button className="nav-link" type="button" key={key} aria-current={current ? "page" : undefined} onClick={() => onNavigate(key)}>
            <Icon size={21} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
