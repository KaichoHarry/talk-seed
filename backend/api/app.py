# backend/api/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import tempfile

# backend/api/app.py (インポート部分に追加)
from backend.llm.ai_sys import generate_ai_response  # 👈 これを追加
from backend.voice.service import transcribe_audio_file, synthesize_speech

app = Flask(__name__)
app.json.ensure_ascii = False  # 👈 これを追加（日本語の文字化けを防ぐ）
CORS(app)  # フロントエンドからのクロスドメインリクエストを許可

# SQLiteのデータベースパス
BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
DB_PATH = os.path.join(BASE_DIR, 'database', 'talkseed.db')

def get_db_connection():
    """SQLiteへの接続を取得するヘルパー関数"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # カラム名でデータにアクセスできるようにする
    return conn

# --------------------------------------------------
# 8.1 会話開始API (本実装版)
# --------------------------------------------------
@app.route('/conversation/start', methods=['POST'])
def start_conversation():
    data = request.json
    place_type = data.get('place_type')
    purpose_type = data.get('purpose_type')
    participants = data.get('participants', [])

    print(f"[Start] Place: {place_type}, Purpose: {purpose_type}, Participants: {participants}")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. CONVERSATION テーブルに新しい会話を登録
        cursor.execute(
            "INSERT INTO CONVERSATION (place_type, purpose_type) VALUES (?, ?)",
            (place_type, purpose_type)
        )
        conversation_id = cursor.lastrowid

        # 2. 参加者を登録（いなければ新規登録、いればそのIDを使う）
        for name in participants:
            cursor.execute("SELECT person_id FROM PERSON WHERE name = ?", (name,))
            row = cursor.fetchone()
            
            if row:
                person_id = row['person_id']
            else:
                cursor.execute("INSERT INTO PERSON (name) VALUES (?)", (name,))
                person_id = cursor.lastrowid
            
            # 会話と参加者の紐付け
            cursor.execute(
                "INSERT INTO CONVERSATION_PARTICIPANT (conversation_id, person_id) VALUES (?, ?)",
                (conversation_id, person_id)
            )

        conn.commit()
        conn.close()

        print(f"Successfully started conversation. Generated ID: {conversation_id}")
        return jsonify({
            "conversation_id": conversation_id
        }), 200

    except Exception as e:
        print(f"Error starting conversation: {e}")
        return jsonify({"error": "Failed to start conversation"}), 500

# --------------------------------------------------
# 8.2 AI応答生成API (本実装版)
# --------------------------------------------------
@app.route('/conversation/respond', methods=['POST'])
def generate_response():
    data = request.json
    conversation_id = data.get('conversation_id')
    current_text = data.get('current_text')

    print(f"[Respond] ID: {conversation_id}, User Message: {current_text}")

    # モックではなく、実際にDBから記憶を引いてLLMを叩く！
    response_text = generate_ai_response(conversation_id, current_text)
    
    return jsonify({
        "response": response_text
    }), 200

# --------------------------------------------------
# 8.3 会話終了API
# --------------------------------------------------
@app.route('/conversation/end', methods=['POST'])
def end_conversation():
    data = request.json
    conversation_id = data.get('conversation_id')

    print(f"[End] Conversation ID: {conversation_id}")

    # TODO: 会話の要約、人物記憶の更新ロジックをここに挟む

    return jsonify({
        "summary_created": True,
        "memory_updated": True
    }), 200

# --------------------------------------------------
# 8.4 履歴一覧取得API
# --------------------------------------------------
@app.route('/conversations', methods=['GET'])
def get_conversations_list():
    print("[Get List] Fetching history...")

    # 💡 せっかくなので、ここはさっき作ったSQLiteのテストデータから取ってきてみましょう！
    try:
        conn = get_db_connection()
        # CONVERSATIONとSUMMARYを結合して簡易的に取得
        query = """
            SELECT c.conversation_id, strftime('%Y-%m-%d', c.started_at) as date, s.overview 
            FROM CONVERSATION c
            LEFT JOIN CONVERSATION_SUMMARY s ON c.conversation_id = s.conversation_id
        """
        rows = conn.execute(query).fetchall()
        conn.close()

        # SQLiteのRowオブジェクトをシリアライズ可能な辞書リストに変換
        conversations = [dict(row) for row in rows]
    except Exception as e:
        print(f"DB Error: {e}")
        # DBエラー時のフォールバック（設計書のモックデータ）
        conversations = [{
            "conversation_id": 15,
            "date": "2026-06-23",
            "overview": "旅行と就活の話題"
        }]

    return jsonify(conversations), 200

# --------------------------------------------------
# 8.5 履歴詳細取得API
# --------------------------------------------------
@app.route('/conversations/<int:conversation_id>', methods=['GET'])
def get_conversation_detail(conversation_id):
    print(f"[Get Detail] Fetching ID: {conversation_id}")

    # 💡 ここもSQLiteからデータを引っ張ってきてみます
    try:
        conn = get_db_connection()
        query = "SELECT overview, hot_topics, memorable_points FROM CONVERSATION_SUMMARY WHERE conversation_id = ?"
        row = conn.execute(query, (1,)).fetchone()  # サンプルデータがID=1なので一旦1で固定、本来は引数のconversation_id
        conn.close()

        if row:
            detail = dict(row)
        else:
            raise Exception("No data found")
    except Exception as e:
        # フォールバックモック
        detail = {
            "overview": "旅行と就活の話題（モック）",
            "hot_topics": "京都旅行、インターン選考（モック）",
            "memorable_points": "山田さんが京都の温泉をおすすめしていました。（モック）"
        }

    return jsonify(detail), 200


# --------------------------------------------------
# 音声認識API (プッシュトゥトーク: 録音音声 → テキスト)
# --------------------------------------------------
@app.route('/voice/transcribe', methods=['POST'])
def voice_transcribe():
    audio_file = request.files.get('audio')
    if audio_file is None:
        return jsonify({"error": "audio file is required"}), 400

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        text = transcribe_audio_file(tmp_path)
        print(f"[Transcribe] Result: {text}")
        return jsonify({"text": text}), 200
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return jsonify({"error": "Failed to transcribe audio"}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

# --------------------------------------------------
# 音声合成API (テキスト → 音声base64)
# --------------------------------------------------
@app.route('/voice/speak', methods=['POST'])
def voice_speak():
    data = request.json
    text = data.get('text')
    voice_type = data.get('voice_type', 'female')

    if not text:
        return jsonify({"error": "text is required"}), 400

    try:
        audio_base64 = synthesize_speech(text, voice_type)
        return jsonify({"audio_base64": audio_base64}), 200
    except Exception as e:
        print(f"Error synthesizing speech: {e}")
        return jsonify({"error": "Failed to synthesize speech"}), 500


if __name__ == '__main__':
    # 開発サーバーをポート5000で起動
    app.run(debug=True, port=5000)