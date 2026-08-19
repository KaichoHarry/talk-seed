# backend/llm/ai_sys.py
import json
import os
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

from backend.database.db import get_db_connection

# .env ファイルから環境変数を読み込む
load_dotenv()

# 明示的に環境変数からAPIキーを取得
api_key = os.getenv("GEMINI_API_KEY")

# 💡 クライアント初期化時にタイムアウトを「30秒」に設定します（Pydanticエラーも出ません）
# 個別リクエスト側ではなく、ここで設定するのが最新SDKの最も安定する挙動です
client = genai.Client(api_key=api_key)

def get_participants_memories(conversation_id):
    """会話IDから参加者とその過去の記憶を取得する"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. 今回の会話に参加している人のIDと名前を取得
    cursor.execute("""
        SELECT p.person_id, p.name 
        FROM CONVERSATION_PARTICIPANT cp
        JOIN PERSON p ON cp.person_id = p.person_id
        WHERE cp.conversation_id = ?
    """, (conversation_id,))
    participants = cursor.fetchall()
    
    memories_text = ""
    participant_names = []
    
    # 2. 各参加者の過去の記憶（MEMORY）を取得
    for p in participants:
        name = p['name']
        participant_names.append(name)
        
        cursor.execute("""
            SELECT category, content FROM MEMORY WHERE person_id = ?
        """, (p['person_id'],))
        memories = cursor.fetchall()
        
        if memories:
            memories_text += f"【{name}さんの過去の記憶・特徴】\n"
            for m in memories:
                memories_text += f"- [{m['category']}] {m['content']}\n"
    
    conn.close()
    return participant_names, memories_text

def generate_ai_response(conversation_id, current_text):
    """過去の記憶をベースに、GeminiでAIの応答メッセージを生成する"""

    start_total = time.time()

    # 1. DBからのデータ取得
    start_db = time.time()
    names, memories_prompt = get_participants_memories(conversation_id)
    end_db = time.time()

    db_duration = end_db - start_db
    print(f"\n[⏱️ TIME LOG] 1. DBからの記憶取得にかかった時間: {db_duration:.4f} 秒")

    return _generate_ai_response_core(names, memories_prompt, current_text, start_total)


def generate_ai_response_stateless(participant_names, current_text):
    """ゲスト用。DBを一切参照せず、フロントから渡された参加者名だけでAIの応答を生成する
    (過去の記憶は無いので、その場の会話だけで応答する)。"""
    return _generate_ai_response_core(participant_names, "", current_text, time.time())


def _generate_ai_response_core(names, memories_prompt, current_text, start_total):
    names_str = "、".join(names) if names else "ユーザー"

    # 2. システム指示の作成
    system_prompt = f"""
あなたは待ち時間の会話を盛り上げるAIアシスタント「TalkSeed」です。
現在、目の前には {names_str} さんたちがいて、会話をしています。

以下の「各メンバーの過去の記憶」を自然に会話に織り交ぜながら、共感し、会話がさらに弾むような質問やリアクションを「1〜2文」の短い音声出力に適した文章で返してください。

{memories_prompt}
"""

    print("--- [Gemini System Debug] ---")
    print(f"User Message: {current_text}")
    print("--------------------------------------")

    # 3. Gemini APIの呼び出し
    # gemini-3.5-flashは高負荷で503が頻発するため、軽量なgemini-flash-lite-latestを使用
    start_api = time.time()
    last_error = None
    for attempt in range(2):  # 503対策で1回だけリトライ
        try:
            response = client.models.generate_content(
                model='gemini-flash-lite-latest',
                contents=current_text,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.7,
                    max_output_tokens=120
                )
            )

            ai_reply = response.text.strip()
            end_api = time.time()

            api_duration = end_api - start_api
            total_duration = end_api - start_total

            print(f"[⏱️ TIME LOG] 2. Gemini APIの応答（通信＋生成）時間: {api_duration:.4f} 秒")
            print(f"[⏱️ TIME LOG] ━━ 総合計時間 (API処理の完了まで): {total_duration:.4f} 秒 ━━\n")

            return ai_reply

        except Exception as e:
            last_error = e
            print(f"\n=== 🚨 Gemini API 詳細エラーログ (試行{attempt + 1}回目) 🚨 ===")
            print(f"エラーの種類 (Type): {type(e)}")
            print(f"エラー内容 (Message): {e}")
            print("=========================================\n")
            time.sleep(0.5)

    if last_error:

        return "おや、少し聞き取れませんでした。もう一度お話しいただけますか？"


def _save_memories(cursor, user_id, names, memories):
    """人物ごとの記憶を保存する。namesは今回の会話参加者名のホワイトリスト。"""
    saved = 0
    for memory in memories:
        name = (memory.get("name") or "").strip()
        content = (memory.get("content") or "").strip()
        category = (memory.get("category") or "会話メモ").strip()

        if not name or not content or name not in names:
            continue

        cursor.execute("SELECT person_id FROM PERSON WHERE name = ? AND user_id = ?", (name, user_id))
        row = cursor.fetchone()
        if not row:
            continue
        person_id = row["person_id"]

        cursor.execute(
            "INSERT INTO MEMORY (person_id, category, content) VALUES (?, ?, ?)",
            (person_id, category, content)
        )
        saved += 1
    return saved


def _summarize_transcript(names, transcript):
    """発話ログ(transcript)をもとにGeminiで要約と人物記憶の抽出を行う(DBへの保存は行わない)。

    transcript: [{"role": "user"|"ai", "content": str}, ...]
    戻り値: (overview, hot_topics, memorable_points, memories)
    """
    messages = [m for m in transcript if m.get("content")]

    if not messages:
        return "この会話では発話の記録がありませんでした。", "", "", []

    transcript_text = "\n".join(
        f"{'利用者' if m['role'] == 'user' else 'AI'}: {m['content']}" for m in messages
    )
    names_str = "、".join(names) if names else "利用者"

    prompt = f"""
以下は{names_str}さんたちとAIが行った会話のログです。この内容をもとに、以下のJSON形式で要約を出力してください。

{{
  "overview": "会話全体の概要（2〜3文）",
  "hot_topics": "盛り上がった話題を「、」区切りで3つ程度",
  "memorable_points": "特に印象に残った発言や出来事（1〜2文）",
  "memories": [
    {{"name": "参加者の名前(必ず次のいずれかから選ぶ: {names_str})", "category": "趣味・好み・出来事などの分類", "content": "次回以降の会話で使える短い事実"}}
  ]
}}

参加者情報が十分でない場合、memoriesは空配列にしてください。JSON以外の文字は出力しないでください。

--- 会話ログ ---
{transcript_text}
"""

    try:
        response = client.models.generate_content(
            model='gemini-flash-lite-latest',
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=500,
                response_mime_type="application/json"
            )
        )
        data = json.loads(response.text)
        return data.get("overview", ""), data.get("hot_topics", ""), data.get("memorable_points", ""), data.get("memories", [])
    except Exception as e:
        print("\n=== 🚨 会話要約生成エラー 🚨 ===")
        print(f"エラーの種類 (Type): {type(e)}")
        print(f"エラー内容 (Message): {e}")
        print("=================================\n")
        return "要約の生成に失敗しました。もう一度お試しください。", "", "", []


def generate_conversation_summary(conversation_id, user_id, transcript):
    """会話終了時に、フロントから渡された発話ログ(transcript)をもとに要約と人物記憶の抽出を
    行いDBへ保存する。会話全文はDBに保存しない（要約のみ保持）。"""
    names, _ = get_participants_memories(conversation_id)
    overview, hot_topics, memorable_points, memories = _summarize_transcript(names, transcript)

    conn = get_db_connection()
    cursor = conn.cursor()

    memory_saved = _save_memories(cursor, user_id, names, memories)

    cursor.execute("DELETE FROM CONVERSATION_SUMMARY WHERE conversation_id = ?", (conversation_id,))
    cursor.execute(
        "INSERT INTO CONVERSATION_SUMMARY (conversation_id, overview, hot_topics, memorable_points) VALUES (?, ?, ?, ?)",
        (conversation_id, overview, hot_topics, memorable_points)
    )
    cursor.execute("UPDATE CONVERSATION SET ended_at = DATETIME('now', 'localtime') WHERE conversation_id = ?", (conversation_id,))
    conn.commit()
    conn.close()

    return {
        "overview": overview,
        "hot_topics": hot_topics,
        "memorable_points": memorable_points,
        "memory_updated": memory_saved > 0
    }


def generate_guest_summary(participant_names, transcript):
    """ゲスト用。DBへは一切保存せず、要約だけをその場で生成して返す(記憶も保存しない)。"""
    overview, hot_topics, memorable_points, _memories = _summarize_transcript(participant_names, transcript)

    return {
        "overview": overview,
        "hot_topics": hot_topics,
        "memorable_points": memorable_points,
        "memory_updated": False
    }