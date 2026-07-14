import { ChevronRight } from "lucide-react";
import homeHero from "../assets/home-hero.png";

export function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="home-hero">
      <div className="home-copy">
        <h1>待ち時間を、会話が生まれる時間に。</h1>
        <p>場所や相手に合わせて、話しやすい一言をそっと届けます。</p>
      </div>
      <div className="hero-illustration">
        <img src={homeHero} alt="待ち時間を、やさしく楽しい会話の時間に変えるAI" />
      </div>
      <button className="button primary" type="button" onClick={onStart}>
        はじめる <ChevronRight size={20} />
      </button>
    </section>
  );
}
