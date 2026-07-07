# backend/api/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
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
# 8.1 会話開始API
# --------------------------------------------------
@app.route('/conversation/start', methods=['POST'])
def start_conversation():
    data = request.json
    place_type = data.get('place_type')
    purpose_type = data.get('purpose_type')
    participants = data.get('participants', [])

    print(f"[Start] Place: {place_type}, Purpose: {purpose_type}, Participants: {participants}")

    # TODO: 本来はここでCONVERSATIONテーブルとCONVERSATION_PARTICIPANTテーブルにインサートする
    
    # 一旦、デモ用に固定のID（設計書の例と同じ15）を返す
    return jsonify({
        "conversation_id": 15
    }), 200

# --------------------------------------------------
# 8.2 AI応答生成API
# --------------------------------------------------
@app.route('/conversation/respond', methods=['POST'])
def generate_response():
    data = request.json
    conversation_id = data.get('conversation_id')
    current_text = data.get('current_text')

    print(f"[Respond] ID: {conversation_id}, User Message: {current_text}")

    # TODO: ここに「1. DBから過去の記憶を取得」「2. LLMに投げて応答生成」のロジックを入れる
    
    # 一旦、設計書の通りのモック応答を返す
    mock_response = "京都いいですね。前回も旅行の話をされていましたよね。今回はどこが一番印象に残りましたか？"
    
    return jsonify({
        "response": mock_response
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


if __name__ == '__main__':
    # 開発サーバーをポート5000で起動
    app.run(debug=True, port=5000)