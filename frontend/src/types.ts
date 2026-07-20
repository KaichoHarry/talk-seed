export type Screen = "home" | "scene" | "voice" | "talk" | "summary" | "history" | "detail";
export type VoiceType = "female" | "male" | "robot";
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
  transcript: string[];
};

export type ConversationSummary = Pick<ConversationHistory, "overview" | "hotTopics" | "memorable" | "transcript">;

export type Topic = {
  label: string;
  text: string;
};
