# Recurring Task Schema Migration

既存の `backend/todo.db` を繰り返しタスク対応スキーマへ移行する手順です。

## 1. 実行コマンド

```bash
cd backend
uv run python scripts/migrate_recurring_task_schema.py
```

デフォルトでは移行前に `todo.backup.<timestamp>.db` が作成されます。

## 2. オプション

- バックアップを作らない場合:

```bash
cd backend
uv run python scripts/migrate_recurring_task_schema.py --skip-backup
```

- DBファイルを明示する場合:

```bash
cd backend
uv run python scripts/migrate_recurring_task_schema.py --db-path /path/to/todo.db
```

## 3. 移行内容

- `todos.recurrence_type` 列追加（`NOT NULL`, default: `none`）
- `todos.previous_todo_id` 列追加（`UNIQUE`, FK `todos.id`, `ON DELETE SET NULL`）
- `owner_id + name` の無条件一意制約を廃止
- 未完了タスク限定の部分一意インデックスを追加
  - `ix_todo_owner_name_incomplete_unique`
  - 条件: `is_completed = 0`
