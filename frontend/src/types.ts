export type Screen = "login" | "home" | "scene" | "voice" | "talk" | "summary" | "history" | "detail";
export type VoiceType = "female" | "male";
export type RecordingState = "idle" | "recording" | "paused";
export type MicState = "idle" | "recording" | "processing";

export type SceneOption = {
  place: string;
  relationship: string;
  mood: string;
};

export type VoiceOption = {
  type: VoiceType;
  volume: number;
  rate: number;
};

export type ConversationHistory = {
  id: string;
  date: string;
  place: string;
  relationship: string;
  overview: string;
  hotTopics: string[];
  memorable: string;
  participants: string[];
};

export type ConversationSummary = Pick<ConversationHistory, "overview" | "hotTopics" | "memorable">;

export type Topic = {
  label: string;
  text: string;
};

export type TranscriptEntry = {
  role: "user" | "ai";
  content: string;
};

export type AuthUser = {
  token: string;
  email: string;
  name: string;
  isGuest?: boolean;
};
