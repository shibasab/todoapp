# Task Progress Schema Migration

既存の `backend/todo.db` を `progress_status` ベースのスキーマへ移行する手順です。

## 1. 実行コマンド

```bash
cd backend
uv run python scripts/migrate_task_progress_schema.py
```

デフォルトでは移行前に `todo.backup.<timestamp>.db` が作成されます。

## 2. オプション

- バックアップを作らない場合:

```bash
cd backend
uv run python scripts/migrate_task_progress_schema.py --skip-backup
```

- DBファイルを明示する場合:

```bash
cd backend
uv run python scripts/migrate_task_progress_schema.py --db-path /path/to/todo.db
```

## 3. 事前チェック

1. `todos` テーブルが存在すること
2. `todos.is_completed` 列が存在すること（既に移行済みでないこと）
3. DBバックアップが作成済みであること（`--skip-backup` 使用時は別手段で取得）

## 4. 移行内容

- `todos.is_completed` を削除
- `todos.progress_status` を追加
  - `NOT NULL`
  - default: `not_started`
  - CHECK: `not_started | in_progress | completed`
- データ変換
  - `is_completed = 1` -> `progress_status = completed`
  - `is_completed = 0` -> `progress_status = not_started`
- インデックス再作成
  - `ix_todos_id`
  - `ix_todo_owner_name_incomplete_unique`（`progress_status != 'completed'` 条件）
  - `ix_todo_owner_progress_status_created_at`

## 5. 移行後チェック

1. `PRAGMA table_info(todos)` に `is_completed` が存在しない
2. `PRAGMA table_info(todos)` に `progress_status` が存在する
3. `SELECT COUNT(*) FROM todos WHERE progress_status NOT IN ('not_started', 'in_progress', 'completed')` が `0`
4. APIの作成・更新・一覧取得が `progressStatus` で正常動作する

## 6. ロールバック

1. アプリケーションを停止
2. 移行で作成されたDBファイルを退避
3. バックアップDB（`todo.backup.<timestamp>.db`）を `todo.db` に戻す
4. アプリケーションを再起動し、API疎通を確認
