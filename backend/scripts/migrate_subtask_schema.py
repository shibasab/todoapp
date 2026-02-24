"""
サブタスク対応向けに todo.db の todos テーブルへ parent_id を追加するスクリプト。

実行例:
    uv run python scripts/migrate_subtask_schema.py
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

PARENT_INDEX_NAME = "idx_todos_parent_id"


def _todos_table_exists(conn: sqlite3.Connection) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'todos'"
    ).fetchone()
    return row is not None


def _get_table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def _get_index_sql(conn: sqlite3.Connection, index_name: str) -> str | None:
    row = conn.execute(
        """
        SELECT sql
        FROM sqlite_master
        WHERE type = 'index' AND name = ?
        """,
        (index_name,),
    ).fetchone()
    if row is None:
        return None
    return row[0]


def _has_parent_index(conn: sqlite3.Connection) -> bool:
    return _get_index_sql(conn, PARENT_INDEX_NAME) is not None


def _is_already_migrated(conn: sqlite3.Connection) -> bool:
    columns = _get_table_columns(conn, "todos")
    return "parent_id" in columns and _has_parent_index(conn)


def _backup_db(db_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = db_path.with_name(
        f"{db_path.stem}.backup.{timestamp}{db_path.suffix}"
    )
    shutil.copy2(db_path, backup_path)
    return backup_path


def _run_migration(conn: sqlite3.Connection) -> None:
    if _is_already_migrated(conn):
        return

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
                progress_status VARCHAR(20) NOT NULL DEFAULT 'not_started',
                recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none',
                previous_todo_id INTEGER UNIQUE,
                parent_id INTEGER,
                FOREIGN KEY(owner_id) REFERENCES users (id),
                FOREIGN KEY(previous_todo_id) REFERENCES todos (id) ON DELETE SET NULL,
                FOREIGN KEY(parent_id) REFERENCES todos (id) ON DELETE CASCADE,
                CHECK (progress_status IN ('not_started', 'in_progress', 'completed'))
            )
            """
        )

        legacy_columns = _get_table_columns(conn, "todos_legacy")
        parent_select = "parent_id" if "parent_id" in legacy_columns else "NULL"

        conn.execute(
            f"""
            INSERT INTO todos (
                id,
                name,
                detail,
                created_at,
                owner_id,
                due_date,
                progress_status,
                recurrence_type,
                previous_todo_id,
                parent_id
            )
            SELECT
                id,
                name,
                detail,
                created_at,
                owner_id,
                due_date,
                progress_status,
                recurrence_type,
                previous_todo_id,
                {parent_select}
            FROM todos_legacy
            """
        )

        conn.execute("DROP TABLE todos_legacy")

        conn.execute(
            """
            CREATE UNIQUE INDEX ix_todo_owner_name_incomplete_unique
            ON todos (owner_id, name)
            WHERE progress_status != 'completed'
            """
        )
        conn.execute(
            """
            CREATE INDEX ix_todo_owner_progress_status_created_at
            ON todos (owner_id, progress_status, created_at)
            """
        )
        conn.execute(
            f"""
            CREATE INDEX {PARENT_INDEX_NAME}
            ON todos (parent_id)
            """
        )

        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")


def main() -> None:
    parser = argparse.ArgumentParser(description="Add parent_id schema to todos table")
    parser.add_argument(
        "--db-path",
        default=str(Path(__file__).resolve().parent.parent / "todo.db"),
        help="Path to sqlite database file",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="Skip backup creation before migration",
    )
    args = parser.parse_args()

    db_path = Path(args.db_path)
    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    if not args.skip_backup:
        backup_path = _backup_db(db_path)
        print(f"Backup created: {backup_path}")

    with sqlite3.connect(db_path) as conn:
        if not _todos_table_exists(conn):
            raise RuntimeError("Migration cannot proceed: todos table does not exist")
        _run_migration(conn)

    print("Subtask schema migration completed.")


if __name__ == "__main__":
    main()
