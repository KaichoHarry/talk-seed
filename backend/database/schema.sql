-- backend/database/schema.sql

-- 外部キー制約を有効化（SQLiteは接続ごとに設定が必要。get_db_connection()側でも都度発行する）
PRAGMA foreign_keys = ON;

-- APP_USER (ログイン許可済みユーザー)
-- アカウント作成は行わず、事前にこのテーブルへ登録されたメールアドレスのみログインできる。
CREATE TABLE IF NOT EXISTS APP_USER (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
);

-- AUTH_SESSION (ログイントークン)
CREATE TABLE IF NOT EXISTS AUTH_SESSION (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES APP_USER(user_id) ON DELETE CASCADE
);

-- PERSON (人物情報。会話相手はユーザーごとに独立させる)
CREATE TABLE IF NOT EXISTS PERSON (
    person_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
    FOREIGN KEY (user_id) REFERENCES APP_USER(user_id) ON DELETE CASCADE
);

-- MEMORY (人物記憶)
CREATE TABLE IF NOT EXISTS MEMORY (
    memory_id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
    FOREIGN KEY (person_id) REFERENCES PERSON(person_id) ON DELETE CASCADE
);

-- CONVERSATION (会話。ユーザーごとに所有者を持つ)
CREATE TABLE IF NOT EXISTS CONVERSATION (
    conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    place_type TEXT,
    purpose_type TEXT,
    started_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
    ended_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES APP_USER(user_id) ON DELETE CASCADE
);

-- CONVERSATION_PARTICIPANT (会話参加者)
CREATE TABLE IF NOT EXISTS CONVERSATION_PARTICIPANT (
    participant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES CONVERSATION(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES PERSON(person_id) ON DELETE CASCADE
);

-- CONVERSATION_SUMMARY (会話要約。会話全文は保存せず要約のみ保持する)
CREATE TABLE IF NOT EXISTS CONVERSATION_SUMMARY (
    summary_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL UNIQUE,
    overview TEXT,
    hot_topics TEXT,
    memorable_points TEXT,
    FOREIGN KEY (conversation_id) REFERENCES CONVERSATION(conversation_id) ON DELETE CASCADE
);
