---
name: spec-execute-plan-pr
description: spec.md・design.md・implementation-tasks.md が揃った Ready な機能仕様について、implementation-tasks の順序で実装を進め、各タスクで別エージェントレビュー・検証・コミット・PR作成まで完了する。Use when the user asks to execute a prepared spec plan and create pull requests task-by-task.
---

# Spec Execute Plan PR

## Overview

`docs/specs/NNN_feature/` 配下の計画済み仕様を、タスク単位で安全に実装してPR化する。  
必ず「実装エージェント」と「レビューエージェント」をタスクごとに分離し、レビューで検出された問題を解消してからコミット・PR作成へ進む。

## Preconditions

- 対象ディレクトリに以下が存在すること
  - `docs/specs/NNN_feature/spec.md`
  - `docs/specs/NNN_feature/design.md`
  - `docs/specs/NNN_feature/implementation-tasks.md`
- `gh` が利用可能であること
- `gh auth status` が成功すること（未ログインなら停止し、ログインを案内）

## Rules

- すべて日本語で出力する（コミットメッセージ、PRタイトル、PR本文、レビューコメントを含む）
- Specに記載がない仕様は実装しない。必要ならユーザーに確認する
- タスクごとに `Red -> Green -> Refactor` を守る
- タスクごとに「変更 + その変更を検証する自動テスト」を同じコミットに含める
- タスクごとに必ず別のレビューエージェントを起動する（レビュー担当の使い回し禁止）
- 既存の未コミット差分を巻き戻さない
- 破壊的コマンド（`git reset --hard` など）を使わない

## Workflow Decision

1. `implementation-tasks.md` から実装順を抽出する
2. 抽出した順序で、未完了タスクを1件だけ選ぶ
3. 下記 `Per-Task Execution` を完了する
4. `implementation-tasks.md` でタスク状態を更新する
5. 次タスクへ進む

## Per-Task Execution

### 1. 要件固定

- `spec.md` と `design.md` から対象要件ID・受け入れ条件を抜き出す
- `implementation-tasks.md` から対象タスクのDoD、対象ファイル、検証方法を確定する
- 依存タスク未完了なら、その理由を記録してスキップ可否を判断する

### 2. 実装エージェント実行

- `spawn_agent(agent_type="worker")` でタスク専用エージェントを作成する
- 指示で明示する内容
  - 担当ファイルと要件ID
  - TDD順序（失敗テスト追加 -> 実装 -> リファクタ）
  - 他者変更の扱い（無関係差分は触らない）
- 完了後、差分とテスト変更を受け取る

### 3. 検証

- 変更対象に応じて必須チェックを実行する
- `backend/` を変更した場合
  - `uv run pytest`
  - `uv run ruff format`
  - `uv run ruff check`
  - `uv run pyrefly check`
- `frontend/` を変更した場合
  - `npm run test`
  - `npm run format`
  - `npm run lint`
  - `npm run typecheck`
- 失敗時は同一タスク内で修正し、再実行する

### 4. レビューエージェント実行

- タスクごとに新しいレビューエージェントを起動する（使い回し禁止）
- レビュー観点
  - バグ/回帰リスク
  - 要件逸脱
  - テスト不足
  - リファクタ時の振る舞い変化
- 指摘があれば修正して再検証する

### 5. コミット

- コミットはタスク単位で1つにまとめる
- 規約どおり `committer "<日本語 Conventional Commits>" <file...>;` を使う
- 実装とテストが同じコミットに入っていることを確認する

### 6. PR作成

- 必要ならタスク専用ブランチを切る
- `git push` して `gh pr create` を実行する
- PR本文に必ず含める
  - 対応タスク名（または要件ID）
  - 変更内容
  - テスト内容と結果
  - 影響範囲

### 7. タスク完了更新

- `implementation-tasks.md` の該当項目を完了状態に更新する
- PR URL を記録する
- 未解決事項があれば `Open Questions` として残す

## Definition Of Done (per task)

- テスト/静的解析がすべて成功している
- レビューエージェントの重要指摘が解消されている
- タスク単位でコミット済み
- タスク単位でPR作成済み
- `implementation-tasks.md` の状態更新が完了している

## Final Report

完了時は以下を簡潔に報告する。

- 実行したタスク一覧（完了/保留）
- タスクごとのPR URL
- 主要なレビュー指摘と対応内容
- 残課題（あれば）

## Failure Handling

- `gh auth status` が失敗した場合: `gh auth login` を案内して停止する
- 仕様不足で判断不能な場合: 不足点・必要判断・選択肢を整理してユーザー確認を待つ
- CI失敗時: 原因を要約し、同一タスク内で修正して再実行する
