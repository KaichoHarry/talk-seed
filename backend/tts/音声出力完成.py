from flask import Flask, jsonify, request, render_template_string
import random
import base64
import asyncio
import edge_tts
# Google GenAI SDK
from google import genai

app = Flask(__name__)

# Gemini クライアントの初期化（※あなたのAPIキーが埋め込まれています）
client = genai.Client(api_key="AQ.Ab8RN6Kt3cSNgUUtQyuZxm_tLUBQukIekAl_XuD61Bp-p5y3Uw")

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

# ★ 話し方（トーン）のマッピングを追加
TONE_MAP = {
    "normal": "標準的な話し方（丁寧すぎずフランクすぎない自然な口調）",
    "frank": "フランクな親しい話し方（〜じゃん？、〜なの？などのタメ口・くだけた口調）",
    "business": "ビジネスライクで非常に丁寧な話し方（〜でしょうか？、〜をお持ちですか？などの敬語・敬体）"
}

# ── edge-ttsでテキストを音声化する非同期関数 ──
async def generate_edge_audio(text, voice_name):
    try:
        communicate = edge_tts.Communicate(text, voice_name)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return base64.b64encode(audio_data).decode('utf-8')
    except Exception as e:
        print(f"edge-ttsエラー: {e}")
        return None

# ── 画面のHTML/JavaScript ──
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI会話支援システム</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background-color: #f5f5f5; color: #333; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        h1 { text-align: center; font-size: 1.5rem; color: #007bff; }
        .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 20px; min-height: 80px; background: #fafafa; }
        .status-badge { display: none; color: #ff9800; font-weight: bold; margin-bottom: 10px; animation: blink 1.5s infinite; }
        @keyframes blink { 0% {opacity: 0.5;} 50% {opacity: 1;} 100% {opacity: 0.5;} }
        .btn { display: block; width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 5px; font-size: 1rem; cursor: pointer; margin-bottom: 10px; }
        .btn:active { background: #0056b3; }
        .btn:disabled { background: #9ca3af; cursor: not-allowed; }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:active { background: #545b62; }
        .setting-group { margin-bottom: 15px; }
        .setting-group label { display: block; font-size: 0.9rem; margin-bottom: 5px; font-weight: bold; }
        .setting-group input, .setting-group select { width: 100%; padding: 8px; border-radius: 5px; border: 1px solid #ccc; box-sizing: border-box; }
    </style>
</head>
<body>
<div class="container">
    <h1>AI会話支援システム</h1>
    
    <div class="setting-group">
        <label for="placeSelect">現在の場所 (place)</label>
        <select id="placeSelect">
            <option value="restaurant" selected>飲食店 (restaurant)</option>
            <option value="live">ライブ会場 (live)</option>
        </select>
    </div>
    
    <div class="setting-group">
        <label for="relationSelect">相手との関係 (relationship)</label>
        <select id="relationSelect">
            <option value="friend" selected>友人 (friend)</option>
            <option value="lover">恋人 (lover)</option>
            <option value="family">家族 (family)</option>
            <option value="first">初対面 (first)</option>
        </select>
    </div>

    <div class="setting-group">
        <label for="toneSelect">話し方 (tone)</label>
        <select id="toneSelect">
            <option value="normal" selected>標準 (ふつう)</option>
            <option value="frank">フランク (タメ口)</option>
            <option value="business">ビジネス (丁寧な敬語)</option>
        </select>
    </div>
    
    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ddd;">
    
    <div class="card">
        <div id="statusBadge" class="status-badge">🔊 AIが話題を読み上げています...</div>
        <p id="topicText" style="font-size: 1.1rem; margin: 0; color: #666;">「話題を作る」ボタンを押してください。</p>
    </div>
    
    <button id="generateBtn" class="btn">話題を作る</button>
    <button id="replayBtn" class="btn btn-secondary" style="display: none;">もう一度読む</button>
    <button id="stopBtn" class="btn btn-secondary" style="display: none; background: #dc3545;">停止</button>
    
    <hr style="margin: 20px 0; border: 0; border-top: 1px solid #ddd;">
    
    <div class="setting-group">
        <label for="voiceSelect">話者タイプ (人間らしいAI音声)</label>
        <select id="voiceSelect">
            <option value="ja-JP-NanamiNeural" selected>ななみ (女性・聞き取りやすい)</option>
            <option value="ja-JP-KeitaNeural">けいた (男性・ハキハキ)</option>
        </select>
    </div>
    
    <div class="setting-group">
        <label for="volumeRange">音量: <span id="volumeVal">1.0</span></label>
        <input type="range" id="volumeRange" min="0.0" max="1.0" step="0.1" value="1.0">
    </div>
</div>

<script>
    let currentAudio = null;
    let currentAudioBase64 = null;
    const generateBtn = document.getElementById('generateBtn');
    const replayBtn = document.getElementById('replayBtn');
    const stopBtn = document.getElementById('stopBtn');
    const topicText = document.getElementById('topicText');
    const statusBadge = document.getElementById('statusBadge');
    const placeSelect = document.getElementById('placeSelect');
    const relationSelect = document.getElementById('relationSelect');
    const toneSelect = document.getElementById('toneSelect'); // ★ toneを取得
    const voiceSelect = document.getElementById('voiceSelect');
    const volumeRange = document.getElementById('volumeRange');

    function playAudio(base64Data) {
        stopAudio();
        if (!base64Data) return;
        const audioSrc = `data:audio/mp3;base64,${base64Data}`;
        currentAudio = new Audio(audioSrc);
        currentAudio.volume = parseFloat(volumeRange.value);
        currentAudio.onplay = () => { statusBadge.style.display = 'block'; stopBtn.style.display = 'block'; };
        currentAudio.onended = () => { statusBadge.style.display = 'none'; stopBtn.style.display = 'none'; };
        currentAudio.onerror = () => { statusBadge.style.display = 'none'; stopBtn.style.display = 'none'; };
        currentAudio.play();
    }

    function stopAudio() {
        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
        statusBadge.style.display = 'none'; stopBtn.style.display = 'none';
    }

    generateBtn.addEventListener('click', () => {
        stopAudio();
        generateBtn.disabled = true;
        topicText.innerText = "AIが話題を考えています...";
        replayBtn.style.display = 'none';
        
        const requestData = {
            place: placeSelect.value,
            relationship: relationSelect.value,
            tone: toneSelect.value, // ★ toneの値をサーバーへ送る
            voice_name: voiceSelect.value
        };
        
        fetch('/api/generate_topic', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                topicText.innerText = data.text;
                if (data.audio) {
                    currentAudioBase64 = data.audio;
                    replayBtn.style.display = 'block'; 
                    playAudio(currentAudioBase64);
                } else {
                    topicText.innerText += "\\n(音声の生成に失敗しました)";
                }
            } else { topicText.innerText = "話題の取得に失敗しました。"; }
        })
        .catch(err => { console.error(err); topicText.innerText = "エラーが発生しました。"; })
        .finally(() => { generateBtn.disabled = false; });
    });

    replayBtn.addEventListener('click', () => { if (currentAudioBase64) playAudio(currentAudioBase64); });
    stopBtn.addEventListener('click', stopAudio);
    volumeRange.addEventListener('input', (e) => {
        document.getElementById('volumeVal').innerText = e.target.value;
        if (currentAudio) currentAudio.volume = parseFloat(e.target.value);
    });
</script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/generate_topic', methods=['POST'])
def generate_topic():
    data = request.get_json() or {}
    place = data.get("place", "restaurant")
    relationship = data.get("relationship", "friend")
    tone = data.get("tone", "normal") # ★ フロントから送られた話し方を取得
    voice_name = data.get("voice_name", "ja-JP-NanamiNeural")
    
    place_ja = PLACE_MAP.get(place, "お出かけ先")
    relation_ja = RELATION_MAP.get(relationship, "知人")
    tone_ja = TONE_MAP.get(tone, "標準的な話し方") # ★ 指示用の日本語に変換
    
    # ── Gemini AIへのプロンプトに「話し方」の指定をブレンド ──
    prompt = (
        f"あなたは会話を支援するAIです。\n"
        f"現在の場所: {place_ja}\n"
        f"相手との関係: {relation_ja}\n"
        f"話し方のトーン: {tone_ja}\n\n"
        f"この状況に最適な、会話のきっかけとなる質問文を【1文だけ】考えてください。前置きや「」は一切不要です。"
    )

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
            
    # ── AIが作った文字を音声データに変換 ──
    audio_data = asyncio.run(generate_edge_audio(topic_text, voice_name))
    
    return jsonify({
        "status": "success",
        "text": topic_text,
        "audio": audio_data
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)