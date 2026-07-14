import { useEffect, useMemo, useState } from "react";
import { endConversation, fetchConversationDetail, fetchConversations, requestAiResponse, startConversation } from "./api";
import { BottomNav } from "./components/BottomNav";
import { initialScene, sampleHistories, topics } from "./data";
import { HistoryDetailScreen } from "./screens/HistoryDetailScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SceneScreen } from "./screens/SceneScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { TalkScreen } from "./screens/TalkScreen";
import { VoiceScreen } from "./screens/VoiceScreen";
import type { ConversationHistory, RecordingState, Screen, Topic, VoiceOption } from "./types";

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [scene, setScene] = useState(initialScene);
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
        <div className="phone-scroll">
          {screen === "home" && <HomeScreen onStart={() => setScreen("scene")} />}
          {screen === "scene" && <SceneScreen scene={scene} setScene={setScene} setupCompleted={setupCompleted} onNext={() => setScreen(setupCompleted ? "talk" : "voice")} />}
          {screen === "voice" && <VoiceScreen voice={voice} setVoice={setVoice} setupCompleted={setupCompleted} isSaving={isApiLoading} onSave={beginConversation} onPreview={playVoice} />}
          {screen === "talk" && (
            <TalkScreen
              scene={scene}
              topic={currentTopic}
              voiceStatus={voiceStatus}
              recording={recording}
              recordingSeconds={recordingSeconds}
              isLoading={isApiLoading}
              onRead={playVoice}
              onDeep={() =>
                askBackend(`${currentTopic.text}\n深掘り質問を作ってください。`, () => {
                  setServerTopic(null);
                  setTopicIndex(1);
                  playVoice();
                })
              }
              onNextTopic={() =>
                askBackend(currentTopic.text, () => {
                  setServerTopic(null);
                  setTopicIndex((value) => value + 1);
                  playVoice();
                })
              }
              onStartRecording={() => setRecording("recording")}
              onPause={() => setRecording(recording === "paused" ? "recording" : "paused")}
              onEnd={finishRecording}
            />
          )}
          {screen === "summary" && <SummaryScreen summary={currentSummary} onSave={saveSummary} onHistory={() => setScreen("history")} onTalk={() => setScreen("talk")} />}
          {screen === "history" && <HistoryScreen histories={histories} onDetail={openHistoryDetail} onDelete={(id) => setHistories((current) => current.filter((history) => history.id !== id))} />}
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

export default App;
