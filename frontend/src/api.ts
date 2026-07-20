import type { ConversationHistory, SceneOption } from "./types";

// VITE_API_BASE_URLが未設定の場合は、今アクセスしているホスト名・プロトコルに対して
// ポート5050で接続する。これにより、PCのlocalhostからでもスマホがLAN経由で
// PCのIPにアクセスした場合(http/https どちらでも)でも同じビルドで正しいバックエンドに繋がる。
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:5050`;

type BackendConversation = {
  conversation_id: number;
  date?: string;
  overview?: string;
  participants?: string[];
};

type BackendDetail = {
  overview?: string;
  hot_topics?: string;
  memorable_points?: string;
  participants?: string[];
  transcript?: string[];
};

type BackendSummary = {
  summary_created: boolean;
  memory_updated: boolean;
  overview?: string;
  hot_topics?: string;
  memorable_points?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`TalkSeed API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeTopics(value?: string) {
  if (!value) return [];
  return value
    .split(/[\n,、，]/)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

function normalizeDate(value?: string) {
  if (!value) return "日時未設定";
  return value.replace(/-/g, "/");
}

export async function startConversation(scene: SceneOption, participants: string[]) {
  const data = await requestJson<{ conversation_id: number }>("/conversation/start", {
    method: "POST",
    body: JSON.stringify({
      place_type: scene.place,
      purpose_type: scene.mood,
      participants
    })
  });

  return data.conversation_id;
}

export async function updateConversationParticipants(id: string, participants: string[]): Promise<string[]> {
  const data = await requestJson<{ participants: string[] }>(`/conversations/${encodeURIComponent(id)}/participants`, {
    method: "PUT",
    body: JSON.stringify({ participants })
  });

  return data.participants;
}

export async function requestAiResponse(conversationId: number, currentText: string) {
  const data = await requestJson<{ response: string }>("/conversation/respond", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      current_text: currentText
    })
  });

  return data.response;
}

export async function endConversation(conversationId: number) {
  const data = await requestJson<BackendSummary>("/conversation/end", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId })
  });

  return {
    summaryCreated: data.summary_created,
    memoryUpdated: data.memory_updated,
    overview: data.overview ?? "",
    hotTopics: normalizeTopics(data.hot_topics),
    memorable: data.memorable_points ?? ""
  };
}

export async function fetchConversations(): Promise<ConversationHistory[]> {
  const rows = await requestJson<BackendConversation[]>("/conversations");

  return rows.map((row) => ({
    id: String(row.conversation_id),
    date: normalizeDate(row.date),
    place: "履歴",
    relationship: "未設定",
    overview: row.overview ?? "会話の概要はまだありません。",
    hotTopics: [],
    memorable: "詳細画面で取得します。",
    transcript: [],
    participants: row.participants ?? []
  }));
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", blob, "recording.webm");

  const response = await fetch(`${API_BASE_URL}/voice/transcribe`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(`TalkSeed API error: ${response.status}`);
  }

  const data = (await response.json()) as { text: string };
  return data.text;
}

export async function synthesizeSpeech(text: string, voiceType: string): Promise<string> {
  const data = await requestJson<{ audio_base64: string }>("/voice/speak", {
    method: "POST",
    body: JSON.stringify({ text, voice_type: voiceType })
  });

  return data.audio_base64;
}

export async function fetchConversationDetail(id: string): Promise<Partial<ConversationHistory>> {
  const detail = await requestJson<BackendDetail>(`/conversations/${encodeURIComponent(id)}`);

  return {
    overview: detail.overview ?? "会話の概要はまだありません。",
    hotTopics: normalizeTopics(detail.hot_topics),
    memorable: detail.memorable_points ?? "印象に残った内容はまだありません。",
    transcript: detail.transcript ?? [],
    participants: detail.participants ?? []
  };
}
