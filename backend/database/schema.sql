-- backend/database/schema.sql

-- 外部キー制約を有効化
PRAGMA foreign_keys = ON;

-- PERSON (人物情報)
CREATE TABLE IF NOT EXISTS PERSON (
    person_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT (DATETIME('now', 'localtime'))
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

-- CONVERSATION (会話)
CREATE TABLE IF NOT EXISTS CONVERSATION (
    conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    place_type TEXT,
    purpose_type TEXT,
    started_at DATETIME DEFAULT (DATETIME('now', 'localtime')),
    ended_at DATETIME
);

-- CONVERSATION_PARTICIPANT (会話参加者)
CREATE TABLE IF NOT EXISTS CONVERSATION_PARTICIPANT (
    participant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES CONVERSATION(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES PERSON(person_id) ON DELETE CASCADE
);

-- CONVERSATION_SUMMARY (会話要約)
CREATE TABLE IF NOT EXISTS CONVERSATION_SUMMARY (
    summary_id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL UNIQUE,
    overview TEXT,
    hot_topics TEXT,
    memorable_points TEXT,
    FOREIGN KEY (conversation_id) REFERENCES CONVERSATION(conversation_id) ON DELETE CASCADE
);