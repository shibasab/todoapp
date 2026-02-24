import sqlite3

from scripts.migrate_subtask_schema import _run_migration


def _create_legacy_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE users (
            id INTEGER NOT NULL PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            email VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
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


def test_migrate_subtask_schema_adds_parent_id_fk_and_index() -> None:
    conn = sqlite3.connect(":memory:")
    try:
        _create_legacy_schema(conn)

        _run_migration(conn)

        columns = conn.execute("PRAGMA table_info(todos)").fetchall()
        column_names = {column[1] for column in columns}
        assert "parent_id" in column_names

        foreign_keys = conn.execute("PRAGMA foreign_key_list(todos)").fetchall()
        parent_fk = [fk for fk in foreign_keys if fk[3] == "parent_id"]
        assert len(parent_fk) == 1
        assert parent_fk[0][2] == "todos"
        assert parent_fk[0][6].upper() == "CASCADE"

        indexes = conn.execute("PRAGMA index_list(todos)").fetchall()
        index_names = {index[1] for index in indexes}
        assert "idx_todos_parent_id" in index_names
    finally:
        conn.close()
