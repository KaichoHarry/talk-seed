# backend/api/app.py
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import os
import secrets
import tempfile
from functools import wraps

from backend.database.db import get_db_connection
from backend.llm.ai_sys import generate_ai_response, generate_conversation_summary
from backend.voice.service import transcribe_audio_file, synthesize_speech

app = Flask(__name__)
app.json.ensure_ascii = False  # 日本語の文字化けを防ぐ
CORS(app)  # フロントエンドからのクロスドメインリクエストを許可

BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/

# --------------------------------------------------
# 認証
# --------------------------------------------------
# アカウント作成機能は無く、事前にAPP_USERへ登録されたメールアドレスのみログインできる。
# パスワードは無いため、メールアドレスを知っていれば誰でもそのユーザーとしてログインできる点に注意
# (小規模な信頼できるグループでの利用を想定した簡易実装)。

def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = auth_header[7:] if auth_header.startswith('Bearer ') else None

        if not token:
            return jsonify({"error": "unauthorized"}), 401

        conn = get_db_connection()
        row = conn.execute(
            "SELECT user_id FROM AUTH_SESSION WHERE token = ?", (token,)
        ).fetchone()
        conn.close()

        if not row:
            return jsonify({"error": "unauthorized"}), 401

        g.user_id = row['user_id']
        return f(*args, **kwargs)

    return wrapper

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({"error": "email is required"}), 400

    conn = get_db_connection()
    user = conn.execute("SELECT user_id, name, email FROM APP_USER WHERE email = ?", (email,)).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "このメールアドレスは登録されていません"}), 401

    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO AUTH_SESSION (token, user_id) VALUES (?, ?)", (token, user['user_id']))
    conn.commit()
    conn.close()

    return jsonify({"token": token, "name": user['name'], "email": user['email']}), 200

@app.route('/auth/logout', methods=['POST'])
@require_auth
def logout():
    auth_header = request.headers.get('Authorization', '')
    token = auth_header[7:]

    conn = get_db_connection()
    conn.execute("DELETE FROM AUTH_SESSION WHERE token = ?", (token,))
    conn.commit()
    conn.close()

    return jsonify({"logged_out": True}), 200

def get_conversation_owner(cursor, conversation_id):
    row = cursor.execute("SELECT user_id FROM CONVERSATION WHERE conversation_id = ?", (conversation_id,)).fetchone()
    return row['user_id'] if row else None

# --------------------------------------------------
# 8.1 会話開始API (本実装版)
# --------------------------------------------------
@app.route('/conversation/start', methods=['POST'])
@require_auth
def start_conversation():
    data = request.json
    place_type = data.get('place_type')
    purpose_type = data.get('purpose_type')
    participants = data.get('participants', [])

    print(f"[Start] User: {g.user_id}, Place: {place_type}, Purpose: {purpose_type}, Participants: {participants}")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. CONVERSATION テーブルに新しい会話を登録
        cursor.execute(
            "INSERT INTO CONVERSATION (user_id, place_type, purpose_type) VALUES (?, ?, ?)",
            (g.user_id, place_type, purpose_type)
        )
        conversation_id = cursor.lastrowid

        # 2. 参加者を登録（このユーザーの中で同名の人物がいなければ新規登録、いればそのIDを使う）
        for name in participants:
            cursor.execute("SELECT person_id FROM PERSON WHERE name = ? AND user_id = ?", (name, g.user_id))
            row = cursor.fetchone()

            if row:
                person_id = row['person_id']
            else:
                cursor.execute("INSERT INTO PERSON (user_id, name) VALUES (?, ?)", (g.user_id, name))
                person_id = cursor.lastrowid

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
@require_auth
def generate_response():
    data = request.json
    conversation_id = data.get('conversation_id')
    current_text = data.get('current_text')

    conn = get_db_connection()
    owner = get_conversation_owner(conn.cursor(), conversation_id)
    conn.close()
    if owner != g.user_id:
        return jsonify({"error": "not found"}), 404

    print(f"[Respond] ID: {conversation_id}, User Message: {current_text}")

    # 実際にDBから記憶を引いてLLMを叩く。会話全文は保存しない(フロント側でのみ一時的に保持する)。
    response_text = generate_ai_response(conversation_id, current_text)

    return jsonify({
        "response": response_text
    }), 200

# --------------------------------------------------
# 8.3 会話終了API
# --------------------------------------------------
@app.route('/conversation/end', methods=['POST'])
@require_auth
def end_conversation():
    data = request.json
    conversation_id = data.get('conversation_id')
    transcript = data.get('transcript', [])  # [{role: 'user'|'ai', content: str}, ...] フロントが保持していたものを渡す。DBには保存しない。

    conn = get_db_connection()
    owner = get_conversation_owner(conn.cursor(), conversation_id)
    conn.close()
    if owner != g.user_id:
        return jsonify({"error": "not found"}), 404

    print(f"[End] Conversation ID: {conversation_id}, Messages: {len(transcript)}")

    try:
        summary = generate_conversation_summary(conversation_id, g.user_id, transcript)
        return jsonify({
            "summary_created": True,
            "memory_updated": summary["memory_updated"],
            "overview": summary["overview"],
            "hot_topics": summary["hot_topics"],
            "memorable_points": summary["memorable_points"]
        }), 200
    except Exception as e:
        print(f"Error generating summary: {e}")
        return jsonify({
            "summary_created": False,
            "memory_updated": False,
            "overview": "",
            "hot_topics": "",
            "memorable_points": ""
        }), 200

# --------------------------------------------------
# 8.4 履歴一覧取得API
# --------------------------------------------------
@app.route('/conversations', methods=['GET'])
@require_auth
def get_conversations_list():
    print(f"[Get List] User: {g.user_id}")

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            SELECT c.conversation_id, strftime('%Y-%m-%d', c.started_at) as date, s.overview
            FROM CONVERSATION c
            LEFT JOIN CONVERSATION_SUMMARY s ON c.conversation_id = s.conversation_id
            WHERE c.user_id = ?
            ORDER BY c.conversation_id DESC
        """
        rows = cursor.execute(query, (g.user_id,)).fetchall()

        conversations = []
        for row in rows:
            conversation = dict(row)
            conversation["participants"] = get_participant_names(cursor, conversation["conversation_id"])
            conversations.append(conversation)

        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")
        conversations = []

    return jsonify(conversations), 200

def get_participant_names(cursor, conversation_id):
    cursor.execute("""
        SELECT p.name
        FROM CONVERSATION_PARTICIPANT cp
        JOIN PERSON p ON cp.person_id = p.person_id
        WHERE cp.conversation_id = ?
        ORDER BY cp.participant_id
    """, (conversation_id,))
    return [row['name'] for row in cursor.fetchall()]

# --------------------------------------------------
# 8.5 履歴詳細取得API
# --------------------------------------------------
@app.route('/conversations/<int:conversation_id>', methods=['GET'])
@require_auth
def get_conversation_detail(conversation_id):
    print(f"[Get Detail] Fetching ID: {conversation_id}")

    conn = get_db_connection()
    cursor = conn.cursor()

    if get_conversation_owner(cursor, conversation_id) != g.user_id:
        conn.close()
        return jsonify({"error": "not found"}), 404

    query = "SELECT overview, hot_topics, memorable_points FROM CONVERSATION_SUMMARY WHERE conversation_id = ?"
    row = cursor.execute(query, (conversation_id,)).fetchone()
    participants = get_participant_names(cursor, conversation_id)
    conn.close()

    detail = dict(row) if row else {"overview": "", "hot_topics": "", "memorable_points": ""}
    detail["participants"] = participants

    return jsonify(detail), 200

# --------------------------------------------------
# 8.6 参加者名の編集API（後から名前を記録・修正する）
# --------------------------------------------------
@app.route('/conversations/<int:conversation_id>/participants', methods=['PUT'])
@require_auth
def update_conversation_participants(conversation_id):
    data = request.json or {}
    names = [n.strip() for n in data.get('participants', []) if n and n.strip()]

    conn = get_db_connection()
    cursor = conn.cursor()

    if get_conversation_owner(cursor, conversation_id) != g.user_id:
        conn.close()
        return jsonify({"error": "not found"}), 404

    try:
        cursor.execute("DELETE FROM CONVERSATION_PARTICIPANT WHERE conversation_id = ?", (conversation_id,))

        for name in names:
            cursor.execute("SELECT person_id FROM PERSON WHERE name = ? AND user_id = ?", (name, g.user_id))
            row = cursor.fetchone()

            if row:
                person_id = row['person_id']
            else:
                cursor.execute("INSERT INTO PERSON (user_id, name) VALUES (?, ?)", (g.user_id, name))
                person_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO CONVERSATION_PARTICIPANT (conversation_id, person_id) VALUES (?, ?)",
                (conversation_id, person_id)
            )

        conn.commit()
        conn.close()

        return jsonify({"participants": names}), 200
    except Exception as e:
        conn.close()
        print(f"Error updating participants: {e}")
        return jsonify({"error": "Failed to update participants"}), 500

# --------------------------------------------------
# 8.7 会話履歴削除API
# --------------------------------------------------
@app.route('/conversations/<int:conversation_id>', methods=['DELETE'])
@require_auth
def delete_conversation(conversation_id):
    conn = get_db_connection()
    cursor = conn.cursor()

    if get_conversation_owner(cursor, conversation_id) != g.user_id:
        conn.close()
        return jsonify({"error": "not found"}), 404

    cursor.execute("DELETE FROM CONVERSATION WHERE conversation_id = ?", (conversation_id,))
    conn.commit()
    conn.close()

    print(f"[Delete] Conversation ID: {conversation_id}")
    return jsonify({"deleted": True}), 200

# --------------------------------------------------
# 音声認識API (プッシュトゥトーク: 録音音声 → テキスト)
# --------------------------------------------------
@app.route('/voice/transcribe', methods=['POST'])
@require_auth
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
@require_auth
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
    # 開発サーバーをポート5050で起動（同一LAN内の他端末からアクセスできるよう0.0.0.0で待ち受ける）
    # 注: macOSのAirPlay受信機能がポート5000を使うことがあるため、衝突を避けて5050を使用している

    # certs/にmkcertで発行した証明書があればHTTPSで起動する。
    # スマホのブラウザはhttps(またはlocalhost)でないとマイク(getUserMedia)を許可しないため。
    project_root = os.path.dirname(BASE_DIR)
    cert_path = os.path.join(project_root, 'certs', 'dev-cert.pem')
    key_path = os.path.join(project_root, 'certs', 'dev-key.pem')

    if os.path.exists(cert_path) and os.path.exists(key_path):
        print(f"HTTPSで起動します (証明書: {cert_path})")
        app.run(debug=True, host='0.0.0.0', port=5050, ssl_context=(cert_path, key_path))
    else:
        print("certs/に証明書が見つからないためHTTPで起動します（README参照）")
        app.run(debug=True, host='0.0.0.0', port=5050)
