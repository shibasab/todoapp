# Implementation Tasks: タスク進捗カンバンボード

## 0. 前提

- 対象Spec: `docs/specs/008_task_progress_kanban_board/spec.md`
- 対象設計: `docs/specs/008_task_progress_kanban_board/design.md`
- 方針:
  - `is_completed` / `isCompleted` は削除する
  - 進捗は `progress_status` / `progressStatus` のみで管理する
  - 本番反映前にデータマイグレーションを必ず実施する

## 1. フェーズ構成

1. Backend Refactor
2. Frontend Refactor
3. Migration Implementation
4. Test / Quality Gate
5. Pre-production Migration Rehearsal
6. Verification

## 2. Backend Tasks

### B-1: モデル・スキーマを `progress_status` 単一化

- 対象ファイル:
  - `backend/src/domain/todo/types.ts`
  - `backend/src/http/todo/schemas.ts`
- 実装内容:
  - `progress_status` カラム/フィールド追加
  - `is_completed` / `isCompleted` を削除
  - zod入出力を `progressStatus` のみに統一
- DoD:
  - APIレスポンスに `isCompleted` が存在しない
  - 不正な `progressStatus` は422になる

### B-2: Repository/Service/Routerを新状態モデルへ移行

- 対象ファイル:
  - `backend/src/infra/todo/prisma-todo-repo-port.ts`
  - `backend/src/usecases/todo/write-todos.ts`
  - `backend/src/http/todo/routes.ts`
- 実装内容:
  - 状態フィルタを `progress_status` に統一
  - 繰り返しタスク生成条件を `progress_status == completed` に置換
  - `status` クエリや `isCompleted` 更新経路を削除
- DoD:
  - 一覧/更新/検索が `progress_status` で成立する
  - 既存の繰り返しタスク挙動が回帰しない

### B-3: DBマイグレーションスクリプト実装（本番前必須）

- 対象ファイル:
  - `backend/prisma/schema.prisma`（新規）
- 実装内容:
  - DBバックアップ作成
  - `todos` テーブル再作成で `is_completed` を物理削除
  - 既存データ移行（`is_completed -> progress_status`）
  - 新インデックス/制約を再作成
  - 移行後整合チェックを実装
- DoD:
  - 移行後スキーマに `is_completed` が存在しない
  - 再実行時の冪等性または安全停止が保証される

### B-4: Migration運用ドキュメント作成

- 対象ファイル:
  - `backend/docs/ARCHITECTURE.md`（新規）
- 実装内容:
  - 実行手順
  - 事前チェック項目
  - ロールバック手順
  - 本番実施タイミングと責任者確認項目
- DoD:
  - 手順のみで第三者が実施できる

### B-5: Backendテスト更新

- 対象ファイル:
  - `backend/tests/todo.test.ts`
  - `backend/tests/todo-update-api.test.ts`
  - `backend/tests/usecases/todo-usecases.test.ts`
  - `backend/tests/todo.test.ts`（新規）
  - `backend/tests/prisma-testing.test.ts`（新規）
- 実装内容:
  - `progressStatus` ベースのAPIテストへ更新
  - migration結果検証テストを追加
  - `isCompleted` 非存在を検証
- DoD:
  - 関連テストがすべて成功

## 3. Frontend Tasks

### F-1: 型とAPI連携を `progressStatus` のみに統一

- 対象ファイル:
  - `frontend/src/models/todo.ts`
  - `frontend/src/hooks/useTodo.ts`
- 実装内容:
  - `isCompleted` を削除
  - `progressStatus` を追加
  - 更新時は `progressStatus` のみ送信
- DoD:
  - 型チェックが通る
  - 旧フィールド参照が残らない

### F-2: 一覧/カンバンUI更新

- 対象ファイル:
  - `frontend/src/pages/DashboardPage.tsx`
  - `frontend/src/components/todo/TodoList.tsx`
  - `frontend/src/components/todo/TodoKanbanBoard.tsx`（新規）
  - `frontend/src/components/todo/TodoSearchControls.tsx`
- 実装内容:
  - 一覧/カンバン切替UI
  - 一覧編集フォームに `progressStatus` 入力
  - カンバン列移動で `progressStatus` 更新
  - 成功時局所反映/失敗時再同期
- DoD:
  - 一覧とカンバンで同一状態を表示
  - 列移動と一覧編集が相互に反映される

### F-3: Frontendテスト/fixture更新

- 対象ファイル:
  - `frontend/tests/pages/DashboardPage.test.tsx`
  - `frontend/tests/pages/DashboardPage.kanban.test.tsx`（新規）
  - `frontend/tests/components/TodoKanbanBoard.test.tsx`（新規）
  - `frontend/tests/fixtures/api/todo/*.json`
- 実装内容:
  - `progressStatus` 前提のfixtureへ更新
  - 一覧/カンバン整合のテスト追加
  - `isCompleted` 参照を削除
- DoD:
  - 既存/追加テストが成功

## 4. Migration Rollout Tasks（本番前作業）

### R-1: ステージングでマイグレーションリハーサル

- 実施内容:
  - 本番同等データで Prisma schema 変更を適用
  - APIスモークテスト
  - UIスモークテスト
- DoD:
  - 重大不整合なし
  - 所要時間とロールバック時間を記録

### R-2: 本番反映時の実施タスク

- 実施内容:
  - メンテナンス時間確保
  - DBバックアップ
  - migration実行
  - デプロイ
  - 事後検証
- DoD:
  - `is_completed` が本番DBから削除済み
  - `progress_status` で正常稼働確認

## 5. Test / Quality Gate

### T-1: Backend

- `cd backend && npm run test`
- `cd backend && npm run format`
- `cd backend && npm run lint`
- `cd backend && npm run typecheck`

### T-2: Frontend

- `cd frontend && npm run test`
- `cd frontend && npm run format`
- `cd frontend && npm run lint`
- `cd frontend && npm run typecheck`

## 6. Verification（Specシナリオ）

- Scenario 1: カンバン3列表示
- Scenario 2: 列移動で更新
- Scenario 3: カンバン変更が一覧へ反映
- Scenario 4: 一覧変更がカンバンへ反映
- Scenario 5: 再表示後も状態保持

## 7. 依存関係と実装順

1. B-1 -> B-2 -> B-5（単体）
2. F-1 -> F-2 -> F-3
3. B-3 -> B-4 -> B-5（migration系）
4. T-1/T-2
5. R-1 -> R-2
6. Scenario 1-5 の受け入れ確認

## 8. 要件トレース（要件ID -> タスク）

| 要件ID | 実装タスク | 検証タスク |
| --- | --- | --- |
| FR-001 | B-1, B-2, F-1 | B-5, F-3 |
| FR-002 | F-2 | F-3, Scenario 1 |
| FR-003 | B-2, F-2 | F-3, Scenario 2 |
| FR-004 | F-2 | Scenario 3, Scenario 4 |
| FR-005 | B-3, F-2 | Scenario 5 |
| FR-006 | B-3, R-1, R-2 | migration mapping検証 |
| NFR-001 | F-2 | request log検証 |
| NFR-002 | B-2, F-2 | 一貫性検証 |

## 9. 決定済み事項

1. カンバン列内並び順は `created_at desc` 固定
2. DnDキーボード操作は初期リリース範囲外

## 10. PR分割（実装順）

### PR-1: Backend API契約を `progress_status` へ移行（Breaking）

- 対応タスク:
  - B-1
  - B-2（API契約・状態更新の部分）
  - B-5（API系テスト）
- 主な変更:
  - `is_completed` / `isCompleted` をモデル・スキーマ・APIから削除
  - `progress_status` / `progressStatus` のみ受け付ける
  - 状態フィルタを `progress_status` に統一
- 自動テスト:
  - 新規:
    - `backend/tests/todo.test.ts`（API契約と状態更新）
  - 既存更新:
    - `backend/tests/todo.test.ts`
    - `backend/tests/todo-update-api.test.ts`
    - `backend/tests/usecases/todo-usecases.test.ts`
  - 補足:
    - 認証系など非関連機能は既存テストで十分なため新規追加不要
- 検証コマンド:
  - `cd backend && npm run test -- tests/todo.test.ts tests/todo-update-api.test.ts tests/usecases/todo-usecases.test.ts`

### PR-2: Frontend型/一覧UIを `progressStatus` へ移行

- 対応タスク:
  - F-1
  - F-2（一覧編集UIの部分）
  - F-3（一覧系テスト更新）
- 主な変更:
  - `Todo` 型から `isCompleted` を削除し `progressStatus` を導入
  - 一覧編集フォームで `progressStatus` を更新可能にする
  - API payloadを `progressStatus` のみに統一
- 自動テスト:
  - 新規:
    - なし（このPRは既存一覧系テスト更新でカバー）
  - 既存更新:
    - `frontend/tests/pages/DashboardPage.test.tsx`
    - `frontend/tests/fixtures/api/todo/*.json`
- 検証コマンド:
  - `cd frontend && npm run test -- tests/pages/DashboardPage.test.tsx`
  - `cd frontend && npm run typecheck`

### PR-3: カンバンUI実装と一覧連動

- 対応タスク:
  - F-2（カンバン部分）
  - F-3（カンバン系テスト）
- 主な変更:
  - `TodoKanbanBoard` 追加
  - 列移動で `progressStatus` を更新
  - 一覧/カンバンを同一状態ソースで連動
- 自動テスト:
  - 新規:
    - `frontend/tests/components/TodoKanbanBoard.test.tsx`
    - `frontend/tests/pages/DashboardPage.kanban.test.tsx`
  - 既存更新:
    - `frontend/tests/pages/DashboardPage.test.tsx`（回帰確認分）
- 検証コマンド:
  - `cd frontend && npm run test -- tests/components/TodoKanbanBoard.test.tsx tests/pages/DashboardPage.kanban.test.tsx tests/pages/DashboardPage.test.tsx`

### PR-4: DB migration実装 + 運用ドキュメント + migration自動テスト

- 対応タスク:
  - B-3
  - B-4
  - B-5（migrationテスト）
- 主な変更:
  - Prisma schema更新と移行手順を整備
  - `backend/docs/ARCHITECTURE.md` を更新
  - `is_completed -> progress_status` 変換と `is_completed` 物理削除
- 自動テスト:
  - 新規:
    - `backend/tests/prisma-testing.test.ts`
  - 既存流用:
    - `backend/tests/todo.test.ts`（移行後スキーマ前提の回帰）
  - 補足:
    - 運用手順書自体への新規テストは不要（スクリプトテストで担保）
- 検証コマンド:
  - `cd backend && npm run test -- tests/prisma-testing.test.ts tests/todo.test.ts`

### PR外作業（リリース手順）

- R-1（ステージングmigrationリハーサル）とR-2（本番実施）は、PRマージ後の運用タスクとして実施する。
