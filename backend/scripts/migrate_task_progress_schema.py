"""
タスク進捗ステータス向けに todo.db の todos テーブルを移行するスクリプト。

実行例:
    uv run python scripts/migrate_task_progress_schema.py
"""

from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path


PARTIAL_UNIQUE_INDEX_NAME = "ix_todo_owner_name_incomplete_unique"
PROGRESS_CREATED_INDEX_NAME = "ix_todo_owner_progress_status_created_at"
VALID_PROGRESS_STATUSES = ("not_started", "in_progress", "completed")


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


def _has_progress_partial_unique_index(conn: sqlite3.Connection) -> bool:
    sql = _get_index_sql(conn, PARTIAL_UNIQUE_INDEX_NAME)
    if sql is None:
        return False
    return "WHERE progress_status != 'completed'" in sql


def _has_progress_created_index(conn: sqlite3.Connection) -> bool:
    return _get_index_sql(conn, PROGRESS_CREATED_INDEX_NAME) is not None


def _is_already_migrated(conn: sqlite3.Connection) -> bool:
    columns = _get_table_columns(conn, "todos")
    has_progress_only = "progress_status" in columns and "is_completed" not in columns
    return (
        has_progress_only
        and _has_progress_partial_unique_index(conn)
        and _has_progress_created_index(conn)
    )


def _backup_db(db_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = db_path.with_name(
        f"{db_path.stem}.backup.{timestamp}{db_path.suffix}"
    )
    shutil.copy2(db_path, backup_path)
    return backup_path


def _validate_after_migration(
    conn: sqlite3.Connection, expected_count: int, expected_completed_count: int
) -> None:
    columns = _get_table_columns(conn, "todos")
    if "is_completed" in columns:
        raise RuntimeError("Migration failed: is_completed column still exists")
    if "progress_status" not in columns:
        raise RuntimeError("Migration failed: progress_status column is missing")

    total_count = conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
    if total_count != expected_count:
        raise RuntimeError(
            f"Migration failed: row count mismatch ({total_count} != {expected_count})"
        )

    completed_count = conn.execute(
        "SELECT COUNT(*) FROM todos WHERE progress_status = 'completed'"
    ).fetchone()[0]
    if completed_count != expected_completed_count:
        raise RuntimeError(
            "Migration failed: completed mapping mismatch "
            f"({completed_count} != {expected_completed_count})"
        )

    invalid_count = conn.execute(
        """
        SELECT COUNT(*)
        FROM todos
        WHERE progress_status NOT IN ('not_started', 'in_progress', 'completed')
        """
    ).fetchone()[0]
    if invalid_count != 0:
        raise RuntimeError(
            f"Migration failed: invalid progress_status values found ({invalid_count})"
        )


def _run_migration(conn: sqlite3.Connection) -> None:
    if _is_already_migrated(conn):
        return

    columns = _get_table_columns(conn, "todos")
    if "is_completed" not in columns:
        raise RuntimeError(
            "Migration cannot proceed: todos.is_completed column does not exist"
        )

    expected_count = conn.execute("SELECT COUNT(*) FROM todos").fetchone()[0]
    expected_completed_count = conn.execute(
        "SELECT COUNT(*) FROM todos WHERE is_completed = 1"
    ).fetchone()[0]

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
                FOREIGN KEY(owner_id) REFERENCES users (id),
                FOREIGN KEY(previous_todo_id) REFERENCES todos (id) ON DELETE SET NULL,
                CHECK (progress_status IN ('not_started', 'in_progress', 'completed'))
            )
            """
        )

        legacy_columns = _get_table_columns(conn, "todos_legacy")
        recurrence_select = (
            "recurrence_type" if "recurrence_type" in legacy_columns else "'none'"
        )
        previous_todo_select = (
            "previous_todo_id" if "previous_todo_id" in legacy_columns else "NULL"
        )

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
                previous_todo_id
            )
            SELECT
                id,
                name,
                detail,
                created_at,
                owner_id,
                due_date,
                CASE
                    WHEN is_completed = 1 THEN 'completed'
                    ELSE 'not_started'
                END,
                {recurrence_select},
                {previous_todo_select}
            FROM todos_legacy
            """
        )

        conn.execute("DROP TABLE todos_legacy")
        conn.execute("CREATE INDEX ix_todos_id ON todos (id)")
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

        _validate_after_migration(conn, expected_count, expected_completed_count)
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
