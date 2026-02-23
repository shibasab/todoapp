# Implementation Tasks: サブタスク作成機能

## 0. ドキュメント情報

- 対象Spec: `docs/specs/009_subtask_creation/spec.md`
- 対象Design: `docs/specs/009_subtask_creation/design.md`
- 作成日: 2026-02-19
- 更新日: 2026-02-24
- 粒度: PR単位 + 検証可能タスク単位
- 実装方針: t_wadaのTDD（Failing Test -> Minimal Implementation -> Refactor）

## 0.1 タスク管理

- [x] B-1: `parent_id` スキーマ追加
- [x] B-2: サブタスク作成API
- [x] B-3: 親完了制御 + 進捗計算
- [x] B-4: 親削除カスケード
- [x] B-5: 繰り返しタスクとの整合ルール実装
- [ ] F-1: 型/クライアント契約更新
- [ ] F-2: 親詳細のサブタスクUI
- [ ] F-3: 親完了拒否UX
- [ ] Q-1: Backend品質ゲート実行
- [ ] Q-2: Frontend品質ゲート実行
- [ ] V-1: 受け入れ確認（Scenario 1-6）

## 1. フェーズ別タスク

### Phase B (Backend)

#### B-1: `parent_id` スキーマ追加

- 対象ファイル（予定）
  - `backend/app/models/todo.py`
  - `backend/scripts/*migration*.py`
  - `backend/tests/*migration*.py`
- 変更
  - `parent_id` + FK + index追加
  - 中間互換スキーマを置かず、最終スキーマへ一括移行
- 先行テスト（Red）
  - マイグレーション後にカラム/制約/index存在
- DoD
  - 最終スキーマ（FK/index/制約）が一回のmigrationで確定
  - スキーマ検証テストが成功

#### B-2: サブタスク作成API

- 対象ファイル（予定）
  - `backend/app/schemas/todo.py`
  - `backend/app/routers/todo.py`
  - `backend/app/services/todo_service.py`
  - `backend/tests/test_todo_subtask_create.py`（新規）
- 変更
  - `parentId`入力、親存在/多階層禁止/タイトル検証
- 先行テスト（Red）
  - 正常作成、親不存在(404)、親がサブタスク(409)、空タイトル(422)
- DoD
  - FR-001/FR-002を満たす

#### B-3: 親完了制御 + 進捗計算

- 対象ファイル（予定）
  - `backend/app/services/todo_service.py`
  - `backend/app/repositories/todo_repository.py`
  - `backend/tests/test_todo_subtask_progress.py`（新規）
- 変更
  - 親完了時の409制御
  - `0/0 (0%)` 含む進捗計算
- 先行テスト（Red）
  - 未完了子ありで409
  - 全完了で親完了成功
  - 子0件で `0/0 (0%)`
- DoD
  - FR-005/FR-006/FR-007/FR-008/FR-010を満たす

#### B-4: 親削除カスケード

- 対象ファイル（予定）
  - `backend/tests/test_todo_subtask_delete.py`（新規 or 既存更新）
- 変更
  - 親削除時の子削除保証
- 先行テスト（Red）
  - 親削除後に子取得不可
- DoD
  - FR-009/NFR-002を満たす


#### B-5: 繰り返しタスクとの整合ルール実装

- 対象ファイル（予定）
  - `backend/app/services/todo_service.py`
  - `backend/tests/test_todo_subtask_recurrence_rules.py`（新規）
- 変更
  - サブタスクへの `recurrence_type != none` を409で拒否
  - 繰り返し親完了時の次回生成でサブタスク非複製を保証
- 先行テスト（Red）
  - サブタスク作成/更新で繰り返し指定時に409
  - 親完了で生成された次回タスクに子が存在しない
- DoD
  - FR-011/FR-012を満たす

### Phase F (Frontend)

#### F-1: 型/クライアント契約更新

- 対象ファイル（予定）
  - `frontend/src/models/todo.ts`
  - `frontend/src/services/todoApi.ts`
  - `frontend/tests/services/todoApi.test.ts`（既存更新）
- 変更
  - `parentId`, `parentTitle`, 進捗項目を型に追加
- 先行テスト（Red）
  - レスポンス変換/送信payload検証
- DoD
  - 型チェックでエラーなし

#### F-2: 親詳細のサブタスクUI

- 対象ファイル（予定）
  - `frontend/src/pages/*`
  - `frontend/src/components/todo/*`
  - `frontend/tests/pages/*subtask*.test.tsx`（新規）
- 変更
  - 追加フォーム・一覧・進捗表示
- 先行テスト（Red）
  - 作成成功で一覧更新
  - 子0件表示
  - 親情報表示
- DoD
  - FR-003/FR-004/FR-005/FR-007/NFR-003を満たす

#### F-3: 親完了拒否UX

- 対象ファイル（予定）
  - `frontend/src/pages/*`
  - `frontend/tests/pages/*subtask*.test.tsx`
- 変更
  - 409受信時の拒否理由表示
- 先行テスト（Red）
  - 拒否文言表示
- DoD
  - FR-010を満たす

### Phase Q (Quality Gate)

- Backend
  - `cd backend && uv run pytest`
  - `cd backend && uv run ruff format`
  - `cd backend && uv run ruff check`
  - `cd backend && uv run pyrefly check`
- Frontend
  - `cd frontend && npm run test`
  - `cd frontend && npm run format`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run typecheck`

## 2. 依存関係

1. B-1 -> B-2 -> B-3 -> B-4 -> B-5
2. F-1 -> F-2 -> F-3
3. B/F完了後にPhase Q

## 3. 要件トレース（要件ID -> タスク/テスト）

| 要件ID | タスク | 主テスト |
| --- | --- | --- |
| FR-001 | B-1, B-2 | 親参照付き作成 |
| FR-002 | B-2, F-2 | 親詳細から作成 |
| FR-003 | F-1, F-2 | 親情報表示 |
| FR-004 | F-2 | 子一覧表示 |
| FR-005 | B-3, F-2 | 進捗表示 |
| FR-006 | B-3, F-2 | 更新後再計算 |
| FR-007 | B-3, F-2 | 0/0表示 |
| FR-008 | B-3 | 親完了拒否 |
| FR-009 | B-1, B-4 | 親削除カスケード |
| FR-010 | B-3, F-3 | 拒否理由表示 |
| FR-011 | B-5 | サブタスク繰り返し拒否 |
| FR-012 | B-5 | 次回生成で子非複製 |
| NFR-001 | B-3 | 集計クエリ確認 |
| NFR-002 | B-1, B-4 | FK/孤立防止 |
| NFR-003 | F-2 | 視認性確認 |

## 4. PR分割（実装順）

### PR-1: Backend最終スキーマ確定 + サブタスク作成API

- 変更
  - B-1, B-2
- 自動テスト
  - 新規: `test_todo_subtask_create.py`
  - 新規/更新: 一括migration検証テスト（中間互換なし）
- 検証コマンド
  - `cd backend && uv run pytest tests/test_todo_subtask_create.py tests/*migration*.py`

### PR-2: Backend親完了制御 + 進捗計算 + 親削除 + 繰り返し整合

- 変更
  - B-3, B-4, B-5
- 自動テスト
  - 新規: `test_todo_subtask_progress.py`
  - 新規/更新: `test_todo_subtask_delete.py`
- 検証コマンド
  - `cd backend && uv run pytest tests/test_todo_subtask_progress.py tests/test_todo_subtask_delete.py tests/test_todo_subtask_recurrence_rules.py`

### PR-3: Frontend型/サブタスクUI/拒否表示

- 変更
  - F-1, F-2, F-3
- 自動テスト
  - 既存更新: API client test
  - 新規: subtask UI test
- 検証コマンド
  - `cd frontend && npm run test -- tests/services/todoApi.test.ts tests/pages/*subtask*.test.tsx`
  - `cd frontend && npm run typecheck`

### PR-4: 全体品質ゲート + 受け入れ確認

- 変更
  - 非機能修正（必要時のみ）
- 自動テスト
  - backend/frontendフルスイート
- 検証コマンド
  - Phase Qの全コマンド

## 5. 受け入れ確認（Spec Scenario 1-6）

- Scenario 1: 親詳細からサブタスク追加
- Scenario 2: サブタスクから親情報認識
- Scenario 3: 親詳細で進捗確認
- Scenario 4: 完了状態変更で進捗更新
- Scenario 5: 子なし親で `0/0 (0%)`
- Scenario 6: 親完了拒否時に理由表示

## 6. 未決事項

- 親情報表示を「テキストのみ」か「リンク付き」か最終決定する。
