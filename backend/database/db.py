# backend/database/db.py
"""
DB接続の切り替えレイヤー。

- 環境変数 TURSO_DATABASE_URL が設定されていれば、Turso(libSQL)へ接続する(本番想定)。
  Tursoはコンテナの再起動やリビルドでもデータが消えない永続DBサービス。
- 設定が無ければ、従来通りローカルのSQLiteファイル(talkseed.db)へ接続する(開発想定)。

呼び出し側(backend/api/app.py, backend/llm/ai_sys.py)は、どちらの場合でも同じ
インターフェース(conn.execute/cursor, row['column']での列アクセス, cursor.lastrowid,
conn.commit/close)で扱えるようにしている。
"""
import os
import sqlite3

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, 'talkseed.db')

TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


class _Row:
    """libSQLのタプル結果を、sqlite3.Rowのように列名(またはインデックス)で参照できるようにする"""
    __slots__ = ("_columns", "_values")

    def __init__(self, columns, values):
        self._columns = columns
        self._values = values

    def __getitem__(self, key):
        if isinstance(key, str):
            return self._values[self._columns.index(key)]
        return self._values[key]

    def keys(self):
        return list(self._columns)

    def __repr__(self):
        return repr(dict(zip(self._columns, self._values)))


class _CursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql, params=()):
        self._cursor.execute(sql, params)
        return self

    def executescript(self, sql):
        self._cursor.executescript(sql)
        return self

    def _columns(self):
        return [d[0] for d in (self._cursor.description or [])]

    def fetchone(self):
        row = self._cursor.fetchone()
        return None if row is None else _Row(self._columns(), row)

    def fetchall(self):
        columns = self._columns()
        return [_Row(columns, row) for row in self._cursor.fetchall()]

    @property
    def lastrowid(self):
        return self._cursor.lastrowid


class _ConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return _CursorWrapper(self._conn.cursor())

    def execute(self, sql, params=()):
        return self.cursor().execute(sql, params)

    def executescript(self, sql):
        return self.cursor().executescript(sql)

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_db_connection():
    """DBへの接続を取得する。TURSO_DATABASE_URLがあればTursoへ、無ければローカルSQLiteへ。"""
    if TURSO_DATABASE_URL:
        import libsql_experimental as libsql

        conn = libsql.connect(TURSO_DATABASE_URL, auth_token=TURSO_AUTH_TOKEN)
        wrapped = _ConnectionWrapper(conn)
        wrapped.execute("PRAGMA foreign_keys = ON")
        return wrapped

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
