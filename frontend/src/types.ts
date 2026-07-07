export type SceneOption = {
  place: string;
  relationship: string;
  mood: string;
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
