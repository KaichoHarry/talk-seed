# backend/database/add_user.py
# ログインを許可するユーザーを、ファイルに書かずコマンド一発でDBへ追加する。
# ローカル・本番どちらでも、この場でメールアドレスを直接渡すだけなのでGitに残らない。
#
# 使い方:
#   python3 backend/database/add_user.py member@example.com "メンバーの名前"
import argparse
import os
import sqlite3

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'talkseed.db')


def add_user(email: str, name: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO APP_USER (email, name) VALUES (?, ?) "
        "ON CONFLICT(email) DO UPDATE SET name = excluded.name",
        (email.strip().lower(), name.strip())
    )
    conn.commit()
    conn.close()
    print(f"登録しました: {email} ({name})")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="ログインを許可するユーザーをAPP_USERへ追加する")
    parser.add_argument("email")
    parser.add_argument("name")
    args = parser.parse_args()
    add_user(args.email, args.name)
