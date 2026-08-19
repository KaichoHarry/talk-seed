import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  deleteConversation,
  endConversation,
  fetchConversationDetail,
  fetchConversations,
  guestLogin as apiGuestLogin,
  login as apiLogin,
  logout as apiLogout,
  requestAiResponse,
  setAuthToken,
  startConversation,
  synthesizeSpeech,
  transcribeAudio,
  updateConversationParticipants
} from "./api";
import { BottomNav } from "./components/BottomNav";
import { initialParticipants, initialScene, sampleHistories, topics } from "./data";
import { HistoryDetailScreen } from "./screens/HistoryDetailScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SceneScreen } from "./screens/SceneScreen";
import { SummaryScreen } from "./screens/SummaryScreen";
import { TalkScreen } from "./screens/TalkScreen";
import { VoiceScreen } from "./screens/VoiceScreen";
import type { AuthUser, ConversationHistory, ConversationSummary, MicState, RecordingState, Screen, Topic, TranscriptEntry, VoiceOption } from "./types";

const AUTH_STORAGE_KEY = "talkseed_auth";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [screen, setScreen] = useState<Screen>("login");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [guestLoginLoading, setGuestLoginLoading] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [scene, setScene] = useState(initialScene);
  const [participants, setParticipants] = useState<string[]>(initialParticipants);
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
  const [micState, setMicState] = useState<MicState>("idle");
  const [lastUserText, setLastUserText] = useState("");
  const [realSummary, setRealSummary] = useState<ConversationSummary | null>(null);
  const [transcriptLog, setTranscriptLog] = useState<TranscriptEntry[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentTopic = serverTopic ?? topics[topicIndex % topics.length];
  const selectedHistory = histories.find((history) => history.id === selectedHistoryId) ?? histories[0];
  const cleanedParticipants = useMemo(() => participants.map((name) => name.trim()).filter(Boolean), [participants]);
  const currentSummary = useMemo(
    () => ({
      overview: `${scene.place}で、${currentTopic.text} という話題から会話が広がりました。`,
      hotTopics: ["好きなこと", "今日の楽しみ", "次にしたいこと"],
      memorable: "会話の中で、次に一緒にやってみたいことが自然に出てきました。"
    }),
    [currentTopic.text, scene.place]
  );
  const summaryToShow = realSummary ?? currentSummary;

  useEffect(() => {
    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as AuthUser;
      setAuthToken(parsed.token);
      setUser(parsed);
      setScreen("home");
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const forceLogout = (message?: string) => {
    setAuthToken(null);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
    setSetupCompleted(false);
    setConversationId(null);
    setScreen("login");
    if (message) showToast(message);
  };

  const handleApiError = (e: unknown, fallbackMessage: string) => {
    if (e instanceof ApiError && e.status === 401) {
      forceLogout("セッションが切れました。もう一度ログインしてください");
      return;
    }
    showToast(fallbackMessage);
  };

  const handleLogin = async (email: string) => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const result = await apiLogin(email);
      const authUser: AuthUser = { token: result.token, email: result.email, name: result.name };
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
      setAuthToken(result.token);
      setUser(authUser);
      setScreen("home");
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "ログインに失敗しました");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoginLoading(true);
    setLoginError("");
    try {
      const result = await apiGuestLogin();
      const authUser: AuthUser = { token: result.token, email: "", name: result.name, isGuest: true };
      setAuthToken(result.token);
      setUser(authUser);
      setScreen("home");
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "ゲストログインに失敗しました");
    } finally {
      setGuestLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    forceLogout();
  };

  const navigate = (next: Screen) => {
    if (!setupCompleted && next !== "home" && next !== "scene" && next !== "voice") return;
    setScreen(next);
  };

  const speak = async (text: string) => {
    setVoiceStatus("音声を生成中です");
    try {
      const audioBase64 = await synthesizeSpeech(text, voice.type);
      const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
      audio.volume = voice.volume / 100;
      audio.playbackRate = voice.rate / 100;
      audio.onended = () => setVoiceStatus("音声は停止中です");
      audio.onerror = () => setVoiceStatus("音声は停止中です");
      setVoiceStatus("AIが読み上げています");
      audio.play().catch(() => setVoiceStatus("音声は停止中です"));
    } catch (e) {
      setVoiceStatus("音声は停止中です");
      handleApiError(e, "音声合成APIに接続できませんでした");
    }
  };

  const playVoice = () => {
    speak(currentTopic.text);
  };

  const sendUserSpeech = async (text: string) => {
    setLastUserText(text);

    if (!conversationId) {
      showToast("会話が開始されていないため送信できません");
      return;
    }

    setIsApiLoading(true);
    try {
      const response = await requestAiResponse(conversationId, text, cleanedParticipants);
      setServerTopic({ label: "AIの返答", text: response });
      setTranscriptLog((current) => [...current, { role: "user", content: text }, { role: "ai", content: response }]);
      speak(response);
    } catch (e) {
      handleApiError(e, "応答APIに接続できませんでした");
    } finally {
      setIsApiLoading(false);
    }
  };

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setMicState("processing");
        try {
          const text = await transcribeAudio(blob);
          if (!text) {
            showToast("聞き取れませんでした。もう一度お試しください");
          } else {
            await sendUserSpeech(text);
          }
        } catch (e) {
          handleApiError(e, "音声認識APIに接続できませんでした");
        } finally {
          setMicState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setMicState("recording");
    } catch {
      showToast("マイクを利用できませんでした");
    }
  };

  const stopMicRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const toggleMicRecording = () => {
    if (micState === "recording") {
      stopMicRecording();
    } else if (micState === "idle") {
      startMicRecording();
    }
  };

  useEffect(() => {
    if (screen !== "history" || !setupCompleted) return;

    let active = true;
    fetchConversations()
      .then((remoteHistories) => {
        if (active) {
          setHistories(remoteHistories);
          if (remoteHistories.length > 0) setSelectedHistoryId(remoteHistories[0].id);
        }
      })
      .catch((e) => {
        if (active) handleApiError(e, "履歴APIに接続できませんでした");
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, setupCompleted]);

  const beginConversation = async () => {
    setIsApiLoading(true);
    setServerTopic(null);
    setRealSummary(null);
    setTranscriptLog([]);

    try {
      const nextConversationId = await startConversation(scene, cleanedParticipants);
      setConversationId(nextConversationId);
      showToast("APIに接続しました");
    } catch (e) {
      setConversationId(null);
      handleApiError(e, "APIに接続できないためモックで開始します");
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
      const response = await requestAiResponse(conversationId, prompt, cleanedParticipants);
      setServerTopic({ label: "AIの応答", text: response });
      setTranscriptLog((current) => [...current, { role: "user", content: prompt }, { role: "ai", content: response }]);
      speak(response);
    } catch (e) {
      fallback();
      handleApiError(e, "応答APIに接続できませんでした");
    } finally {
      setIsApiLoading(false);
    }
  };

  const finishRecording = async () => {
    if (conversationId) {
      setIsApiLoading(true);
      try {
        const result = await endConversation(conversationId, transcriptLog, cleanedParticipants);
        setRealSummary({
          overview: result.overview || "会話の要約を生成できませんでした。",
          hotTopics: result.hotTopics,
          memorable: result.memorable
        });
        showToast(result.memoryUpdated ? "会話を要約し、記憶を更新しました" : "会話を要約しました");
      } catch (e) {
        setRealSummary(null);
        handleApiError(e, "会話終了APIに接続できませんでした");
      } finally {
        setIsApiLoading(false);
      }
    } else {
      setRealSummary(null);
    }

    setTranscriptLog([]);
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
                  hotTopics: detail.hotTopics?.length ? detail.hotTopics : history.hotTopics
                }
              : history
          )
        );
      } catch (e) {
        handleApiError(e, "履歴詳細APIに接続できませんでした");
      } finally {
        setIsApiLoading(false);
      }
    }

    setScreen("detail");
  };

  const saveParticipants = async (id: string, names: string[]) => {
    const cleaned = names.map((name) => name.trim()).filter(Boolean);

    if (/^\d+$/.test(id)) {
      try {
        await updateConversationParticipants(id, cleaned);
      } catch (e) {
        handleApiError(e, "参加者の保存に失敗しました");
        return;
      }
    }

    setHistories((current) => current.map((history) => (history.id === id ? { ...history, participants: cleaned } : history)));
    showToast("参加者を保存しました");
  };

  const removeHistory = async (id: string) => {
    if (/^\d+$/.test(id)) {
      try {
        await deleteConversation(id);
      } catch (e) {
        handleApiError(e, "履歴の削除に失敗しました");
        return;
      }
    }

    setHistories((current) => current.filter((history) => history.id !== id));
    showToast("履歴を削除しました");
  };

  const saveSummary = () => {
    const nextHistory: ConversationHistory = {
      id: conversationId ? String(conversationId) : `mock-${Date.now()}`,
      date: "2026/06/30 10:45",
      place: scene.place,
      relationship: scene.relationship,
      overview: summaryToShow.overview,
      hotTopics: summaryToShow.hotTopics,
      memorable: summaryToShow.memorable,
      participants: cleanedParticipants
    };
    setHistories((current) => [nextHistory, ...current]);
    setSelectedHistoryId(nextHistory.id);
    showToast("保存が完了しました");
  };

  return (
    <main className="app-stage">
      <section className={`phone-shell ${screen === "home" || screen === "login" ? "home-shell" : ""}`}>
        <div className="phone-scroll">
          {screen === "login" && (
            <LoginScreen
              isLoading={loginLoading}
              errorMessage={loginError}
              onLogin={handleLogin}
              onGuestLogin={handleGuestLogin}
              isGuestLoading={guestLoginLoading}
            />
          )}
          {screen === "home" && <HomeScreen onStart={() => setScreen("scene")} />}
          {screen === "scene" && (
            <SceneScreen
              scene={scene}
              setScene={setScene}
              participants={participants}
              setParticipants={setParticipants}
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
              onPreview={() => speak("こんにちは、TalkSeedです。音声のプレビューです。")}
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
              micState={micState}
              lastUserText={lastUserText}
              onToggleMic={toggleMicRecording}
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
          {screen === "summary" && <SummaryScreen summary={summaryToShow} onSave={saveSummary} onHistory={() => setScreen("history")} onTalk={() => setScreen("talk")} />}
          {screen === "history" && (
            <HistoryScreen histories={histories} onDetail={openHistoryDetail} onDelete={removeHistory} onLogout={handleLogout} isGuest={user?.isGuest} />
          )}
          {screen === "detail" && selectedHistory && (
            <HistoryDetailScreen
              history={selectedHistory}
              onBack={() => setScreen("history")}
              onDelete={() => {
                removeHistory(selectedHistory.id);
                setScreen("history");
              }}
              onSaveParticipants={(names) => saveParticipants(selectedHistory.id, names)}
            />
          )}
        </div>
        {screen !== "home" && screen !== "login" && setupCompleted && <BottomNav screen={screen} onNavigate={navigate} />}
        {toast && <div className="toast is-visible">{toast}</div>}
      </section>
    </main>
  );
}

export default App;
