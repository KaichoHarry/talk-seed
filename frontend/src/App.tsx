import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  FileText,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Pause,
  Play,
  Settings,
  Sparkles,
  Trash2,
  Utensils,
  Volume2
} from "lucide-react";
import talkseedMark from "./assets/talkseed-mark.svg";
import friendsWaiting from "./assets/friends-waiting.svg";
import mascot from "./assets/mascot.svg";
import { endConversation, fetchConversationDetail, fetchConversations, requestAiResponse, startConversation } from "./api";
import type { ConversationHistory, SceneOption } from "./types";

type Screen = "home" | "scene" | "voice" | "talk" | "summary" | "history" | "detail";
type VoiceType = "female" | "male" | "robot";
type RecordingState = "idle" | "recording" | "paused";

type VoiceOption = {
  type: VoiceType;
  volume: number;
  rate: number;
};

type Topic = {
  label: string;
  text: string;
};

const initialScene: SceneOption = {
  place: "ライブ会場",
  relationship: "友人",
  mood: "盛り上げたい"
};

const topics: Topic[] = [
  { label: "AIの話題", text: "今日はここに来るのを楽しみにしていましたか？" },
  { label: "深掘り質問", text: "どんなところが特に楽しみだったんですか？" },
  { label: "リアクション", text: "それは素敵ですね。待っている時間も少しわくわくしますね。" },
  { label: "話題転換", text: "最近、思わず誰かに話したくなった出来事はありますか？" }
];

const sampleHistories: ConversationHistory[] = [
  {
    id: "live-20260625",
    date: "2026/06/25 14:30",
    place: "ライブ会場",
    relationship: "友人",
    overview: "ライブの感想や好きなアーティストの話題で盛り上がりました。",
    hotTopics: ["好きなアーティスト", "ライブの思い出", "音楽の好み"],
    memorable: "次はフェスにも行きたい、という話が出ました。",
    transcript: ["AI：今日は来てよかったですか？", "A：本当に楽しかったです。", "B：次のライブも行きたいね。"]
  },
  {
    id: "food-20260618",
    date: "2026/06/18 18:20",
    place: "飲食店",
    relationship: "家族",
    overview: "おすすめの料理や最近行ったお店の話で楽しく会話しました。",
    hotTopics: ["好きな料理", "また行きたい店", "家で作りたいもの"],
    memorable: "次はデザートが評判のお店に行きたいという話になりました。",
    transcript: ["AI：今日いちばん気になるメニューはありますか？", "A：限定メニューが気になる。", "B：みんなで分けて食べよう。"]
  },
  {
    id: "park-20260610",
    date: "2026/06/10 10:05",
    place: "テーマパーク",
    relationship: "友人",
    overview: "アトラクションの待ち時間に、次に回りたい場所の話で盛り上がりました。",
    hotTopics: ["乗りたいアトラクション", "写真を撮りたい場所", "帰りに食べたいもの"],
    memorable: "待ち時間のあいだに次の回り方が決まりました。",
    transcript: ["AI：次に乗りたいものはありますか？", "A：水のアトラクション。", "B：そのあと写真も撮りたい。"]
  }
];

const placeOptions = [
  { value: "飲食店", title: "飲食店での待ち時間", desc: "おすすめ料理やお店の話題へ", Icon: Utensils },
  { value: "ライブ会場", title: "ライブ・イベント会場", desc: "好きな曲や思い出を広げます", Icon: Mic },
  { value: "テーマパーク", title: "テーマパーク", desc: "乗りたいアトラクションを話題に", Icon: Sparkles },
  { value: "イベント会場", title: "イベント会場", desc: "展示や人との出会いを話しやすく", Icon: Home },
  { value: "移動中", title: "その他の待ち時間", desc: "移動中や旅行中にも使えます", Icon: MapPin }
];

const relationshipOptions = ["友人", "恋人", "家族", "初対面", "グループ"];
const moodOptions = ["楽しく話したい", "落ち着いて話したい", "盛り上げたい", "深い話をしたい"];

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [scene, setScene] = useState<SceneOption>(initialScene);
  const [voice, setVoice] = useState<VoiceOption>({ type: "female", volume: 80, rate: 100 });
  const [topicIndex, setTopicIndex] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState("音声は停止中です");
  const [recording, setRecording] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(135);
  const [histories, setHistories] = useState<ConversationHistory[]>(sampleHistories);
  const [selectedHistoryId, setSelectedHistoryId] = useState(sampleHistories[0].id);
  const [toast, setToast] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [serverTopic, setServerTopic] = useState<Topic | null>(null);
  const [isApiLoading, setIsApiLoading] = useState(false);

  const currentTopic = serverTopic ?? topics[topicIndex % topics.length];
  const selectedHistory = histories.find((history) => history.id === selectedHistoryId) ?? histories[0];
  const currentSummary = useMemo(
    () => ({
      overview: `${scene.place}で、${currentTopic.text} という話題から会話が広がりました。`,
      hotTopics: ["好きなこと", "今日の楽しみ", "次にしたいこと"],
      memorable: "会話の中で、次に一緒にやってみたいことが自然に出てきました。",
      transcript: [`AI：${currentTopic.text}`, "A：それ、いい話題だね。", "B：次はもう少し詳しく話してみたい。"]
    }),
    [currentTopic.text, scene.place]
  );

  const navigate = (next: Screen) => {
    if (!setupCompleted && next !== "home" && next !== "scene" && next !== "voice") return;
    setScreen(next);
  };

  const playVoice = () => {
    setVoiceStatus("AIが読み上げています");
    window.setTimeout(() => setVoiceStatus("音声は停止中です"), 1200);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  useEffect(() => {
    if (screen !== "history" || !setupCompleted) return;

    let active = true;
    fetchConversations()
      .then((remoteHistories) => {
        if (active && remoteHistories.length > 0) {
          setHistories(remoteHistories);
          setSelectedHistoryId(remoteHistories[0].id);
        }
      })
      .catch(() => {
        if (active) showToast("履歴APIに接続できませんでした");
      });

    return () => {
      active = false;
    };
  }, [screen, setupCompleted]);

  const beginConversation = async () => {
    setIsApiLoading(true);
    setServerTopic(null);

    try {
      const nextConversationId = await startConversation(scene);
      setConversationId(nextConversationId);
      showToast("APIに接続しました");
    } catch {
      setConversationId(null);
      showToast("APIに接続できないためモックで開始します");
    } finally {
      setIsApiLoading(false);
      setSetupCompleted(true);
      setScreen("talk");
    }
  };

  const askBackend = async (prompt: string, fallback: () => void) => {
    if (!conversationId) {
      fallback();
      return;
    }

    setIsApiLoading(true);
    try {
      const response = await requestAiResponse(conversationId, prompt);
      setServerTopic({ label: "AIの応答", text: response });
      playVoice();
    } catch {
      fallback();
      showToast("応答APIに接続できませんでした");
    } finally {
      setIsApiLoading(false);
    }
  };

  const finishRecording = async () => {
    if (conversationId) {
      setIsApiLoading(true);
      try {
        await endConversation(conversationId);
        showToast("会話終了APIに送信しました");
      } catch {
        showToast("会話終了APIに接続できませんでした");
      } finally {
        setIsApiLoading(false);
      }
    }

    setRecording("idle");
    setRecordingSeconds((value) => value + 24);
    setScreen("summary");
  };

  const openHistoryDetail = async (id: string) => {
    setSelectedHistoryId(id);

    if (/^\d+$/.test(id)) {
      setIsApiLoading(true);
      try {
        const detail = await fetchConversationDetail(id);
        setHistories((current) =>
          current.map((history) =>
            history.id === id
              ? {
                  ...history,
                  ...detail,
                  hotTopics: detail.hotTopics?.length ? detail.hotTopics : history.hotTopics,
                  transcript: detail.transcript?.length ? detail.transcript : history.transcript
                }
              : history
          )
        );
      } catch {
        showToast("履歴詳細APIに接続できませんでした");
      } finally {
        setIsApiLoading(false);
      }
    }

    setScreen("detail");
  };

  const saveSummary = () => {
    const nextHistory: ConversationHistory = {
      id: conversationId ? String(conversationId) : `mock-${Date.now()}`,
      date: "2026/06/30 10:45",
      place: scene.place,
      relationship: scene.relationship,
      overview: currentSummary.overview,
      hotTopics: currentSummary.hotTopics,
      memorable: currentSummary.memorable,
      transcript: currentSummary.transcript
    };
    setHistories((current) => [nextHistory, ...current]);
    setSelectedHistoryId(nextHistory.id);
    showToast("保存が完了しました");
  };

  return (
    <main className="app-stage">
      <section className={`phone-shell ${screen === "home" ? "home-shell" : ""}`}>
        {screen !== "home" && <StatusBar />}
        <div className="phone-scroll">
          {screen === "home" && <HomeScreen onStart={() => setScreen("scene")} />}
          {screen === "scene" && (
            <SceneScreen
              scene={scene}
              setScene={setScene}
              setupCompleted={setupCompleted}
              onNext={() => setScreen(setupCompleted ? "talk" : "voice")}
            />
          )}
          {screen === "voice" && (
            <VoiceScreen
              voice={voice}
              setVoice={setVoice}
              setupCompleted={setupCompleted}
              isSaving={isApiLoading}
              onSave={beginConversation}
              onPreview={playVoice}
            />
          )}
          {screen === "talk" && (
            <TalkScreen
              scene={scene}
              topic={currentTopic}
              voiceStatus={voiceStatus}
              recording={recording}
              recordingSeconds={recordingSeconds}
              isLoading={isApiLoading}
              onRead={playVoice}
              onDeep={() => askBackend(`${currentTopic.text}\n深掘り質問を作ってください。`, () => {
                setServerTopic(null);
                setTopicIndex(1);
                playVoice();
              })}
              onNextTopic={() => askBackend(currentTopic.text, () => {
                setServerTopic(null);
                setTopicIndex((value) => value + 1);
                playVoice();
              })}
              onStartRecording={() => setRecording("recording")}
              onPause={() => setRecording(recording === "paused" ? "recording" : "paused")}
              onEnd={finishRecording}
            />
          )}
          {screen === "summary" && (
            <SummaryScreen summary={currentSummary} onSave={saveSummary} onHistory={() => setScreen("history")} onTalk={() => setScreen("talk")} />
          )}
          {screen === "history" && (
            <HistoryScreen
              histories={histories}
              onDetail={openHistoryDetail}
              onDelete={(id) => setHistories((current) => current.filter((history) => history.id !== id))}
            />
          )}
          {screen === "detail" && selectedHistory && (
            <HistoryDetailScreen
              history={selectedHistory}
              onBack={() => setScreen("history")}
              onDelete={() => {
                setHistories((current) => current.filter((history) => history.id !== selectedHistory.id));
                setScreen("history");
              }}
            />
          )}
        </div>
        {screen !== "home" && setupCompleted && <BottomNav screen={screen} onNavigate={navigate} />}
        {toast && <div className="toast is-visible">{toast}</div>}
      </section>
    </main>
  );
}

function StatusBar() {
  return (
    <div className="statusbar" aria-hidden="true">
      <span>9:41</span>
      <span className="signal">
        <span />
        <span />
        <span />
        <span className="battery" />
      </span>
    </div>
  );
}

function Header({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div>{left}</div>
      <h1 className="topbar-title">{title}</h1>
      <div>{right}</div>
    </header>
  );
}

function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button className="icon-button" type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className="home-hero">
      <div className="hero-copy">
        <div className="logo-row" aria-label="TalkSeed">
          <img src={talkseedMark} alt="" />
          <span className="logo-text">TalkSeed</span>
        </div>
        <h1>待ち時間を、会話が生まれる時間に変えるAI</h1>
        <p>いまの場所に合わせて、話しやすい話題や質問をそっと届けます。</p>
      </div>
      <div className="hero-illustration">
        <span className="floating-note one" aria-hidden="true">
          …
        </span>
        <img src={friendsWaiting} alt="待ち時間にスマートフォンを見ながら会話する二人" />
        <span className="floating-note two" aria-hidden="true">
          ♡
        </span>
      </div>
      <button className="button primary" type="button" onClick={onStart}>
        はじめる <ChevronRight size={20} />
      </button>
    </section>
  );
}

function SceneScreen({
  scene,
  setScene,
  setupCompleted,
  onNext
}: {
  scene: SceneOption;
  setScene: React.Dispatch<React.SetStateAction<SceneOption>>;
  setupCompleted: boolean;
  onNext: () => void;
}) {
  return (
    <>
      <Header title="シーン選択" right={<Settings size={20} className="header-icon" />} />
      <section className="page-intro">
        <h2>シーンを選択してください</h2>
        <p>AIが会話しやすい話題を考えるために、いまの状況を選びます。</p>
      </section>
      <h2 className="section-title">
        <Sparkles size={18} /> 場所
      </h2>
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
      <h2 className="section-title">
        <Sparkles size={18} /> {title}
      </h2>
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

function VoiceScreen({
  voice,
  setVoice,
  setupCompleted,
  isSaving,
  onSave,
  onPreview
}: {
  voice: VoiceOption;
  setVoice: React.Dispatch<React.SetStateAction<VoiceOption>>;
  setupCompleted: boolean;
  isSaving: boolean;
  onSave: () => void;
  onPreview: () => void;
}) {
  return (
    <>
      <Header title="音声設定" right={<Volume2 size={21} className="header-icon" />} />
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

function TalkScreen({
  scene,
  topic,
  voiceStatus,
  recording,
  recordingSeconds,
  isLoading,
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
  onRead: () => void;
  onDeep: () => void;
  onNextTopic: () => void;
  onStartRecording: () => void;
  onPause: () => void;
  onEnd: () => void;
}) {
  const isRecording = recording !== "idle";
  return (
    <>
      <Header title="会話サポート" left={<MessageCircle size={22} className="header-icon" />} right={<Settings size={20} className="header-icon" />} />
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

function SummaryScreen({
  summary,
  onSave,
  onHistory,
  onTalk
}: {
  summary: Pick<ConversationHistory, "overview" | "hotTopics" | "memorable" | "transcript">;
  onSave: () => void;
  onHistory: () => void;
  onTalk: () => void;
}) {
  return (
    <>
      <Header title="会話まとめ" left={<FileText size={22} className="header-icon" />} />
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

function SummaryCards({ summary }: { summary: Pick<ConversationHistory, "overview" | "hotTopics" | "memorable" | "transcript"> }) {
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

function HistoryScreen({ histories, onDetail, onDelete }: { histories: ConversationHistory[]; onDetail: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <>
      <Header title="履歴一覧" left={<CalendarClock size={22} className="header-icon" />} />
      <section className="history-list">
        {histories.map((history) => (
          <article className="soft-card history-card" key={history.id}>
            <span className="history-icon">
              {history.place.includes("飲食") ? <Utensils size={24} /> : history.place.includes("ライブ") ? <Mic size={24} /> : <Sparkles size={24} />}
            </span>
            <div className="history-main">
              <h3>
                {history.date}
                <br />
                {history.place}
              </h3>
              <p>{history.overview}</p>
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

function HistoryDetailScreen({ history, onBack, onDelete }: { history: ConversationHistory; onBack: () => void; onDelete: () => void }) {
  return (
    <>
      <Header title="履歴詳細" left={<IconButton label="戻る" onClick={onBack}><ArrowLeft size={20} /></IconButton>} right={<Heart size={20} className="header-icon pink" />} />
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

function BottomNav({ screen, onNavigate }: { screen: Screen; onNavigate: (screen: Screen) => void }) {
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

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default App;
