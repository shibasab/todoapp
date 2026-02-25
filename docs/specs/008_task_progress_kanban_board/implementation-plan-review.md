# Implementation Plan Review: タスク進捗カンバンボード

## 0. レビュー情報

- 対象: `docs/specs/008_task_progress_kanban_board/implementation-tasks.md`
- 実施日: 2026-02-15
- 観点: 着手順 / 依存関係 / 本番移行リスク / テスト容易性

## 1. 指摘一覧（重要度順）

## High

### H-1: 本番前migrationリハーサルを必須ゲートにするべき

- 判断理由:
  - 物理カラム削除を伴うため、本番一発実行はリスクが高い
- 修正方針:
  - `R-1`（ステージングリハーサル）完了を `R-2` 実施条件にする
- 反映状況:
  - 反映済み（`implementation-tasks.md` 4, 7）

## Medium

### M-1: Backend/Frontend差分の同時反映が必要

- 判断理由:
  - `isCompleted` 削除後は片系先行デプロイで通信不整合が起きる
- 修正方針:
  - B/F双方を同リリースで反映する前提を明示
- 反映状況:
  - 反映済み（`implementation-tasks.md` 0, 7）

### M-2: migrationテストを通常テストと分離して管理するべき

- 判断理由:
  - アプリ挙動テストと移行検証は失敗原因が異なる
- 修正方針:
  - Prisma移行検証テスト（`prisma-testing.test.ts`）を独立追加
- 反映状況:
  - 反映済み（`implementation-tasks.md` B-5）

### M-3: 受け入れ検証はSpecシナリオに固定するべき

- 判断理由:
  - 合格基準を曖昧にすると完了判断にばらつきが出る
- 修正方針:
  - Scenario 1-5を明示チェック項目として維持
- 反映状況:
  - 反映済み（`implementation-tasks.md` 6）

## Low

### L-1: 非機能項目の測定観点を簡潔に残すと再現性が上がる

- 判断理由:
  - NFR-001/NFR-002は感覚評価だけだとぶれやすい
- 修正方針:
  - request logと整合性テストの実施を明示
- 反映状況:
  - 反映済み（`implementation-tasks.md` 8）

## 2. 最終整合チェック（Spec/Design/Plan）

| 要件ID | 設計済み | 計画済み | 未決 |
| --- | --- | --- | --- |
| FR-001 | Yes | Yes | No |
| FR-002 | Yes | Yes | No |
| FR-003 | Yes | Yes | No |
| FR-004 | Yes | Yes | No |
| FR-005 | Yes | Yes | No |
| FR-006 | Yes | Yes | No |
| NFR-001 | Yes | Yes | No |
| NFR-002 | Yes | Yes | No |

## 3. 総評

- 重大な未解決事項なし
- migration実装と本番前リハーサルが計画に組み込まれている
- 実装着手可能
