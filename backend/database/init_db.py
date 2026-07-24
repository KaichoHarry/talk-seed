# backend/database/init_db.py
import sqlite3
import os

# パスの設定
BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'talkseed.db')
SCHEMA_PATH = os.path.join(BASE_DIR, 'schema.sql')
DATA_PATH = os.path.join(BASE_DIR, 'sample_data.sql')
LOCAL_USERS_PATH = os.path.join(BASE_DIR, 'local_users.sql')  # Git管理外

def init_db():
    # 既存のDBファイルがあれば一旦削除（クリーンな状態から始めるため）
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Removed existing database at: {DB_PATH}")

    print(f"Creating new database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. スキーマ（テーブル定義）の実行
    print("Applying schema...")
    with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())

    # 2. サンプルデータのインサート
    print("Inserting sample data...")
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        cursor.executescript(f.read())

    # 3. ログイン許可ユーザーのインサート（Git管理外のローカルファイル。無ければスキップ）
    if os.path.exists(LOCAL_USERS_PATH):
        print("Inserting local users (login-allowed emails)...")
        with open(LOCAL_USERS_PATH, 'r', encoding='utf-8') as f:
            cursor.executescript(f.read())
    else:
        print(f"NOTE: {LOCAL_USERS_PATH} が無いため、ログイン許可ユーザーは登録されていません。")

    conn.commit()
    conn.close()
    print("Database initialization completed successfully!")

if __name__ == '__main__':
    init_db()