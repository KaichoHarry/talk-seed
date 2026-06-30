-- backend/database/sample_data.sql

-- テスト用人物の登録
INSERT INTO PERSON (name) VALUES ('山田');
INSERT INTO PERSON (name) VALUES ('鈴木');

-- 山田さんの過去の記憶（AIが参照する用）
INSERT INTO MEMORY (person_id, category, content) 
VALUES (1, 'travel', '前回の会話で、京都旅行（特に温泉）が好きだと言っていた。');

-- 鈴木さんの過去の記憶
INSERT INTO MEMORY (person_id, category, content) 
VALUES (2, 'hobby', '最近カメラを始めて、週末はよく写真を撮りに出かけている。');

-- 過去の会話履歴のモック（履歴一覧API等で確認する用）
INSERT INTO CONVERSATION (place_type, purpose_type, started_at, ended_at)
VALUES ('cafe', 'friend_chat', '2026-06-23 14:00:00', '2026-06-23 14:30:00');

-- 過去の会話の参加者（山田と鈴木が参加）
INSERT INTO CONVERSATION_PARTICIPANT (conversation_id, person_id) VALUES (1, 1);
INSERT INTO CONVERSATION_PARTICIPANT (conversation_id, person_id) VALUES (1, 2);

-- 過去の会話の要約
INSERT INTO CONVERSATION_SUMMARY (conversation_id, overview, hot_topics, memorable_points)
VALUES (1, '旅行と就活の話題', '京都旅行、インターン選考', '山田さんが京都の温泉をおすすめし、鈴木さんがそれをメモしていた。');