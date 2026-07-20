# backend/llm/ai_sys.py
import json
import os
import sqlite3
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

# .env ファイルから環境変数を読み込む
load_dotenv()

# 明示的に環境変数からAPIキーを取得
api_key = os.getenv("GEMINI_API_KEY")

# 💡 クライアント初期化時にタイムアウトを「30秒」に設定します（Pydanticエラーも出ません）
# 個別リクエスト側ではなく、ここで設定するのが最新SDKの最も安定する挙動です
client = genai.Client(api_key=api_key)

# データベースのパス
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
DB_PATH = os.path.join(BASE_DIR, 'database', 'talkseed.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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
    names_str = "、".join(names) if names else "ユーザー"
    end_db = time.time()
    
    db_duration = end_db - start_db
    print(f"\n[⏱️ TIME LOG] 1. DBからの記憶取得にかかった時間: {db_duration:.4f} 秒")

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
                    max_output_tokens=120,
                    thinking_config=types.ThinkingConfig(thinking_budget=0)
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


def get_conversation_messages(conversation_id):
    """会話IDに紐づく発話ログ（ユーザー発話・AI応答）を時系列で取得する"""
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT role, content FROM CONVERSATION_MESSAGE WHERE conversation_id = ? ORDER BY message_id",
        (conversation_id,)
    ).fetchall()
    conn.close()
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def save_conversation_message(conversation_id, role, content):
    """1発話分をCONVERSATION_MESSAGEへ保存する"""
    if not content:
        return
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO CONVERSATION_MESSAGE (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, role, content)
    )
    conn.commit()
    conn.close()


def _save_memories(cursor, names, memories):
    """人物ごとの記憶を保存する。namesは今回の会話参加者名のホワイトリスト。"""
    saved = 0
    for memory in memories:
        name = (memory.get("name") or "").strip()
        content = (memory.get("content") or "").strip()
        category = (memory.get("category") or "会話メモ").strip()

        if not name or not content or name not in names:
            continue

        cursor.execute("SELECT person_id FROM PERSON WHERE name = ?", (name,))
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


def generate_conversation_summary(conversation_id):
    """会話終了時に、発話ログをもとにGeminiで要約と人物記憶の抽出を行い、DBへ保存する"""
    names, _ = get_participants_memories(conversation_id)
    messages = get_conversation_messages(conversation_id)

    conn = get_db_connection()
    cursor = conn.cursor()

    if not messages:
        overview = "この会話では発話の記録がありませんでした。"
        hot_topics = ""
        memorable_points = ""
        memory_saved = 0
    else:
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
                    response_mime_type="application/json",
                    thinking_config=types.ThinkingConfig(thinking_budget=0)
                )
            )
            data = json.loads(response.text)
            overview = data.get("overview", "")
            hot_topics = data.get("hot_topics", "")
            memorable_points = data.get("memorable_points", "")
            memory_saved = _save_memories(cursor, names, data.get("memories", []))
        except Exception as e:
            print("\n=== 🚨 会話要約生成エラー 🚨 ===")
            print(f"エラーの種類 (Type): {type(e)}")
            print(f"エラー内容 (Message): {e}")
            print("=================================\n")
            overview = "要約の生成に失敗しました。もう一度お試しください。"
            hot_topics = ""
            memorable_points = ""
            memory_saved = 0

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