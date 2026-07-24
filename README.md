# TalkSeed

## 概要

TalkSeedは、飲食店やイベント会場などの待ち時間で会話が途切れてしまう場面に、AIが会話参加者として加わり、話題提案・深掘り質問・共感などで会話を支援するシステムです。

利用者はマイクボタンを押して発話し、AIが音声認識・応答生成・音声読み上げまでを行います（プッシュトゥトーク方式）。過去の会話で得た人物の情報を記憶し、次回以降の会話で活用します。

事前に登録されたメールアドレスでログインするユーザーごとに、会話履歴・人物記憶を分離して保持します（アカウント作成機能はありません）。プライバシーに配慮し、会話全文はDBに保存せず、AIが生成した要約のみを保持します。

詳細な要件・設計は [docs/](./docs) を参照してください。

---

## 主な機能

### 実装済み

* メールアドレスによるログイン（事前登録制、アカウント作成なし）とユーザーごとのデータ分離
* シーン（場所・関係性・気分）選択に応じたAIの話題提案
* マイクボタンでの発話 → 音声認識(Whisper) → AI応答生成(Gemini) → 音声読み上げ(edge-tts) の一連の会話フロー
* 人物ごとの記憶(MEMORY)を参照したパーソナライズ応答
* 会話終了時のAIによる自動要約（概要・盛り上がった話題・印象的な内容）と人物記憶の自動更新（会話全文はDBに保存しない）
* 会話履歴のDB保存、一覧・詳細閲覧、削除
* 参加者名の入力（シーン選択画面）と、履歴詳細画面からの後編集

### 未実装・今後の課題

* パスワードや二要素認証は無く、登録済みメールアドレスを知っていればログインできる簡易認証（信頼できる小規模グループでの利用を想定）
* Web上への実デプロイ（現状はローカルネットワークでの利用を想定した構成）

---

## システム構成

| 項目 | 技術 |
| --- | --- |
| フロントエンド | React + Vite (TypeScript) |
| バックエンド | Flask |
| 音声認識 (STT) | Whisper (`openai-whisper`, サーバーサイド) |
| 音声合成 (TTS) | edge-tts (サーバーサイドでmp3生成) |
| 生成AI | Google Gemini API (`gemini-flash-lite-latest`) |
| データベース | SQLite |

---

## セットアップ・起動方法

### 必要環境

* Python 3.12系
* Node.js
* ffmpeg（Whisperの音声デコードに使用）
* Gemini APIキー

### 1. 環境変数

プロジェクトルートに `.env` を作成し、以下を設定してください。

```
GEMINI_API_KEY=your-api-key-here
```

Tursoに接続する場合（本番想定）は、加えて以下も設定してください。未設定の場合は自動でローカルのSQLiteファイルが使われます。

```
TURSO_DATABASE_URL=libsql://xxxxx.turso.io
TURSO_AUTH_TOKEN=xxxxx
```

### 2. バックエンド

```bash
pip install -r backend/requirements.txt
python3 -m backend.api.app
```

`http://127.0.0.1:5050` で起動します（macOSのAirPlay受信機能がポート5000を使うため、衝突を避けて5050にしています）。

### 3. フロントエンド

```bash
cd frontend
npm install
npm run dev
```

`http://127.0.0.1:5173` にアクセスしてください。

---

## スマートフォンから使う（ローカルHTTPS）

このアプリはWeb上に公開せず、PC上でローカルサーバーを立てて個人のPC・スマホの範囲内だけで動かすことを想定しています（プライバシーへの配慮のため）。PCとスマホを同じネットワーク（PCのテザリング／スマホのテザリング／同一WiFiなど）につなげば、スマホのブラウザからPCのローカルサーバーにアクセスして操作できます。

ただし、ブラウザのマイク機能（`getUserMedia`）は `https` か `localhost` でしか動作しないため、スマホからLAN経由で`http`のままアクセスするとマイクボタンが使えません。そのため [mkcert](https://github.com/FiloSottile/mkcert) でローカル用のHTTPS証明書を発行して使います。

### 1. mkcertのインストールとCAの信頼設定（初回のみ・PCで実行）

```bash
brew install mkcert
mkcert -install
```

`mkcert -install` はPCの証明書ストアに変更を加える操作のため、必ずご自身のターミナルで実行してください（パスワード入力が必要です）。

### 2. 証明書の発行

プロジェクトルートで実行します。`<LAN_IP>` はPCのローカルIP（`ipconfig getifaddr en0` などで確認できます）に置き換えてください。

```bash
mkdir -p certs
mkcert -cert-file certs/dev-cert.pem -key-file certs/dev-key.pem localhost 127.0.0.1 ::1 <LAN_IP>
```

`certs/` はGit管理対象外（`.gitignore`済み）です。バックエンド・フロントエンドともに `certs/dev-cert.pem` `certs/dev-key.pem` があれば自動でHTTPS起動に切り替わります。

### 3. サーバー起動とスマホからの接続

いつも通り `python3 -m backend.api.app` と `npm run dev` を実行すると、以下のようにHTTPSで起動します。

```
➜  Local:   https://localhost:5173/
➜  Network: https://<LAN_IP>:5173/
```

### 4. スマホ側でCA証明書を信頼する

自己署名証明書なので、スマホ側にも mkcert のルート証明書を信頼させる必要があります。PCで以下を実行するとルート証明書の場所が分かります。

```bash
mkcert -CAROOT
```

表示されたフォルダの中の `rootCA.pem` をAirDropやメールなどでスマホに送り、プロファイルとしてインストールしてください（iPhoneの場合はインストール後に「設定 > 一般 > 情報 > 証明書信頼設定」で完全に信頼する必要があります）。

その後、スマホのブラウザで `https://<LAN_IP>:5173` にアクセスすれば、PC上のTalkSeedをスマホから（マイクも含めて）操作できます。

### 注意点

* LAN IPはネットワークに再接続すると変わることがあります。変わった場合は証明書を発行し直してください。
* スマホ側のWiFi/テザリングで「クライアント分離（AP分離）」が有効だと、同じネットワークにいてもPCにアクセスできません。その場合は設定をオフにするか、PCのテザリングにスマホをぶら下げる構成にしてください。
* PCのファイアウォールで接続がブロックされる場合は、Python（Flask）・Node（Vite）の着信を許可してください。

---

## データベースをTursoに切り替える（本番デプロイ向け）

Web上のホスティング（Hugging Face Spacesなど）にバックエンドをデプロイする場合、コンテナのローカルファイルシステムは再ビルド・再起動でリセットされることが多く、SQLiteファイルをそのまま使うとデータが消えてしまいます。そのため本番では [Turso](https://turso.tech/)（SQLite互換の永続クラウドDB）へ接続する構成にしています。

`TURSO_DATABASE_URL` が `.env` に設定されていれば自動でTursoへ接続し、無ければ今まで通りローカルのSQLiteファイルを使います（コードは変更不要）。

### 1. Turso CLIのインストールとログイン（初回のみ）

```bash
brew install tursodatabase/tap/turso
turso auth signup   # 初めての場合。2回目以降は turso auth login
```

### 2. データベースの作成

```bash
turso db create talkseed
```

### 3. 接続情報の取得

```bash
turso db show talkseed --url
turso db tokens create talkseed
```

それぞれの出力を `.env` の `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` に設定してください。

### 4. スキーマの反映

ローカルのSQLiteと違い、Tursoのデータベースは空の状態で作られるので、スキーマを流し込む必要があります。

```bash
turso db shell talkseed < backend/database/schema.sql
```

ログイン許可ユーザーも同様に、`turso db shell talkseed` でシェルに入って `INSERT INTO APP_USER ...` を直接実行するか、`backend/database/add_user.py` を実行する環境（`.env`にTURSO_DATABASE_URL等を設定した状態）から追加してください。

---

## Webへのデプロイ

バックエンドは **Hugging Face Spaces**（Docker SDK）、フロントエンドは **Vercel** にデプロイする構成です。

### バックエンド（Hugging Face Spaces）

1. Hugging Faceでアカウント作成 → 「New Space」でSDKに`Docker`を選択して作成
2. Space の `Settings > Variables and secrets` に `GEMINI_API_KEY` / `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` をSecretとして登録
3. リポジトリルートの `Dockerfile` を使って、Spaceの git remote へpushするとビルド・デプロイされる

```bash
git remote add space https://huggingface.co/spaces/<username>/<space-name>
git push space develop:main
```

`Dockerfile`はCPU専用のPyTorchを明示的にインストールしている点がポイントです（指定しないとGPU向けCUDAライブラリ込みで数GB分のダウンロードが発生し、ビルドが極端に重くなるため）。

### フロントエンド（Vercel）

1. VercelでGitHub連携しリポジトリをインポート
2. `Root Directory` を `frontend` に設定（Framework Presetは自動でVite）
3. 環境変数 `VITE_API_BASE_URL` に、Hugging Face SpacesのURL（例: `https://<username>-<space-name>.hf.space`）を設定

---

## ログインを許可するユーザーの登録

アカウント作成機能は無く、事前に `APP_USER` テーブルへ登録されたメールアドレスでのみログインできます。個人のメールアドレスは**Gitで管理しているファイルには絶対に書かない**でください。

### 方法1: コマンドで直接追加する（推奨）

DBに直接INSERTするだけなので、既存の会話履歴を消さずに済み、Gitにも一切残りません。ローカルでも本番サーバー上でも同じ方法が使えます。

```bash
python3 backend/database/add_user.py member@example.com "メンバーの名前"
```

### 方法2: ローカル用ファイルにまとめて書いておく

DBリセット時にまとめて登録したい場合は、`backend/database/local_users.sql`（Git管理外、`.gitignore`済み）に書いてください。

```sql
-- backend/database/local_users.sql （このファイルは自分で作成する。sample_data.sqlには書かないこと）
INSERT INTO APP_USER (email, name) VALUES ('you@example.com', 'あなたの名前');
```

作成後、以下を実行するとDBに反映されます（`local_users.sql`があれば自動で読み込まれます。ただしDBが初期化され既存の会話履歴も消えるので注意）。

```bash
python3 backend/database/init_db.py
```

---

## 使い方

1. **ログイン画面**で、事前に登録されたメールアドレスを入力してログイン
2. **トップ画面**で「はじめる」を押す
3. **シーン選択画面**で場所・関係性・気分を選び、「一緒にいる相手の名前」に分かる範囲で名前を入力して「次へ」
   * 名前が分からない場合は空欄のままでもよく、後から履歴画面で編集できる
4. **音声設定画面**でAIの声（女性／男性）・音量・話速を選び、「保存して会話をはじめる」
5. **会話サポート画面**
   * AIが最初の話題を音声付きで提示する
   * 中央のマイクボタンを押して発話し、もう一度押すと録音が止まり、音声認識 → AI応答生成 → 音声読み上げが自動で行われる
   * 「もう一度読む」「深掘り質問」「次の話題へ」でもAIとやり取りできる
   * 「会話を記録する」を押すと記録中の表示（REC・タイマー）になり、「記録を終了する」でAIが会話全体を要約する
6. **会話まとめ画面**でAIが生成した要約・盛り上がった話題・印象的な内容を確認し、「保存する」で履歴に残す
7. **履歴画面**で過去の会話を一覧・詳細確認・削除でき、詳細画面では参加者名の追加・修正ができる。右上の「ログアウト」でログアウトできる

---

## 想定利用シーン

* 飲食店やライブ会場の待ち時間
* テーマパークの待機列
* 初対面同士の交流、オンライン通話 など

---

## 開発体制

本プロジェクトは4名のチームで開発を行っています。

---

## 開発状況

プロトタイプ稼働中。シーン選択 → マイクでの会話 → 履歴保存までの一連の流れが動作します。

---

## 今後の予定

* 本番運用を見据えた認証強化（現状はメールアドレスのみの簡易認証）

---

## ライセンス

未定
