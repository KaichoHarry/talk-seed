import type { ReactNode } from "react";

export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      {right && <div className="topbar-action">{right}</div>}
    </header>
  );
}
