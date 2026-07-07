from flask import Flask, render_template, jsonify, request
import random
import base64
import asyncio
import edge_tts
# Google GenAI SDK
from google import genai

app = Flask(__name__, template_folder=".")

# Gemini クライアントの初期化
client = genai.Client(api_key="YOUR_GEMINI_API_KEY_HERE")

# フォールバック用固定データベース
TOPIC_DATABASE = {
    "live": {
        "friend": ["今日一番楽しみにしている曲は何？", "物販で狙ってるグッズもう買えた？"],
        "lover": ["今日のライブ、一緒に来れて本当に嬉しい！一番楽しみな演出は？"],
        "family": ["このアーティストの曲、最初に教えてくれたの誰だっけ？"]
    },
    "restaurant": {
        "friend": ["ここのメニューで一番気になってるやつ何？", "最近行ったお店で美味しかったところ教えて！"],
        "lover": ["今日のお店、雰囲気良いね！次に行ってみたいデートスポットはある？"]
    }
}
DEFAULT_TOPICS = ["最近買って一番良かったものって何ですか？", "最近ハマっていることは？"]

PLACE_MAP = {"restaurant": "飲食店・レストラン", "live": "ライブ会場・コンサート"}
RELATION_MAP = {"friend": "友人同士", "lover": "恋人（デート中）", "family": "家族", "first": "初対面の人"}

# ── edge-ttsで人間の声を生成する非同期関数 ──
async def generate_edge_audio(text, voice_name):
    try:
        # 音声合成の実行（MP3形式で生成される）
        communicate = edge_tts.Communicate(text, voice_name)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        
        # JavaScriptで再生しやすいようにBase64文字列に変換
        return base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        print(f"edge-ttsエラー: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate_topic', methods=['POST'])
def generate_topic():
    data = request.get_json() or {}
    
    place = data.get("place", "restaurant")
    relationship = data.get("relationship", "friend")
    
    # フロントから送られてきた音声タイプ（デフォルトは自然な女性声のNanami）
    voice_name = data.get("voice_name", "ja-JP-NanamiNeural")
    
    # ── Geminiによる話題生成 ──
    place_ja = PLACE_MAP.get(place, "お出かけ先")
    relation_ja = RELATION_MAP.get(relationship, "知人")
    
    prompt = f"あなたは会話を支援するAIです。現在の場所: {place_ja}、相手との関係: {relation_ja}に最適な、会話のきっかけとなる質問文を【1文だけ】考えてください。前置きや「」は一切不要です。"

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        topic_text = response.text.strip()
    except Exception:
        try:
            topic_pool = TOPIC_DATABASE.get(place, {}).get(relationship, DEFAULT_TOPICS)
            topic_text = random.choice(topic_pool)
        except Exception:
            topic_text = random.choice(DEFAULT_TOPICS)
            
    # ── edge-tts音声の生成（非同期関数を同期的に実行） ──
    audio_data = asyncio.run(generate_edge_audio(topic_text, voice_name))
    
    return jsonify({
        "status": "success",
        "text": topic_text,
        "audio": audio_data
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)