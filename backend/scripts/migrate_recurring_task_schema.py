"""
繰り返しタスク機能向けに todo.db の todos テーブルを移行するスクリプト。

実行例:
    uv run python scripts/migrate_recurring_task_schema.py
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


PARTIAL_UNIQUE_INDEX_NAME = "ix_todo_owner_name_incomplete_unique"


def _todos_table_exists(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'todos'"
    ).fetchone()
    return row is not None


def _get_todo_columns(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("PRAGMA table_info(todos)").fetchall()
    return {row[1] for row in rows}


def _has_partial_unique_index(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type = 'index' AND name = ?
        """,
        (PARTIAL_UNIQUE_INDEX_NAME,),
    ).fetchone()
    if row is None:
        return False
    sql = row[0] or ""
    return "WHERE is_completed = 0" in sql


def _is_already_migrated(conn: sqlite3.Connection) -> bool:
    columns = _get_todo_columns(conn)
    has_columns = {"recurrence_type", "previous_todo_id"}.issubset(columns)
    return has_columns and _has_partial_unique_index(conn)


def _backup_db(db_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = db_path.with_name(
        f"{db_path.stem}.backup.{timestamp}{db_path.suffix}"
    )
    shutil.copy2(db_path, backup_path)
    return backup_path


def _run_migration(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        conn.execute("BEGIN")
        conn.execute("ALTER TABLE todos RENAME TO todos_legacy")
        conn.execute(
            """
            CREATE TABLE todos (
                id INTEGER NOT NULL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                detail TEXT NOT NULL DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                owner_id INTEGER NOT NULL,
                due_date DATE NULL,
                is_completed BOOLEAN NOT NULL DEFAULT 0,
                recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none',
                previous_todo_id INTEGER UNIQUE,
                FOREIGN KEY(owner_id) REFERENCES users (id),
                FOREIGN KEY(previous_todo_id) REFERENCES todos (id) ON DELETE SET NULL
            )
            """
        )
        conn.execute(
            """
            INSERT INTO todos (
                id,
                name,
                detail,
                created_at,
                owner_id,
                due_date,
                is_completed,
                recurrence_type,
                previous_todo_id
            )
            SELECT
                id,
                name,
                detail,
                created_at,
                owner_id,
                due_date,
                is_completed,
                'none',
                NULL
            FROM todos_legacy
            """
        )
        conn.execute("DROP TABLE todos_legacy")
        conn.execute("CREATE INDEX ix_todos_id ON todos (id)")
        conn.execute(
            """
            CREATE UNIQUE INDEX ix_todo_owner_name_incomplete_unique
            ON todos (owner_id, name)
            WHERE is_completed = 0
            """
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db-path",
        default=str(Path(__file__).resolve().parent.parent / "todo.db"),
        help="移行対象SQLiteファイルのパス",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="移行前バックアップを作成しない",
    )
    args = parser.parse_args()

    db_path = Path(args.db_path).resolve()
    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    with sqlite3.connect(db_path) as conn:
        if not _todos_table_exists(conn):
            raise RuntimeError("todos table not found in database")

        if _is_already_migrated(conn):
            print("Migration is already applied. No changes were made.")
            return

    if not args.skip_backup:
        backup_path = _backup_db(db_path)
        print(f"Backup created: {backup_path}")

    with sqlite3.connect(db_path) as conn:
        _run_migration(conn)

    print("Migration completed successfully.")


if __name__ == "__main__":
    main()
