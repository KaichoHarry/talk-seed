import type { ConversationHistory, SceneOption, Topic } from "./types";

export const initialScene: SceneOption = {
  place: "ライブ会場",
  relationship: "友人",
  mood: "盛り上げたい"
};

export const topics: Topic[] = [
  { label: "AIの話題", text: "今日はここに来るのを楽しみにしていましたか？" },
  { label: "深掘り質問", text: "どんなところが特に楽しみだったんですか？" },
  { label: "リアクション", text: "それは素敵ですね。待っている時間も少しわくわくしますね。" },
  { label: "話題転換", text: "最近、思わず誰かに話したくなった出来事はありますか？" }
];

export const sampleHistories: ConversationHistory[] = [
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
