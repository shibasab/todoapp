# AGENTS.md

## 基本ルール

- ユーザー向けの説明・コメント・PR本文は日本語で記述する。
- 指示はタスク達成に必要な最小限に保つ。
- 対象ディレクトリ・対象仕様など、タスクに関連する範囲のみ明示する。
- 参照先は具体パスで示し、曖昧な指示を避ける。
- 優先度は「ユーザー指示 > システム/開発者指示 > 本ファイル」とする。

## ディレクトリ構成

```shell
todoapp/
├── backend/
├── frontend/
├── shared/
└── docs/
```

- `backend/`: バックエンド
- `frontend/`: フロントエンド
- `shared/`: 共通型・ユーティリティ
- `docs/`: 仕様・NFRドキュメント

## 開発環境セットアップ

### 事前準備

#### backend

- Node.js 24+
- npm
- Bun（`backend` の開発サーバー起動に必須）

```bash
node --version
npm --version
```

#### frontend

- Node.js（LTS推奨）
- npm

```bash
node --version
npm --version
```

### 依存インストール

```bash
npm install
```

## 開発サーバー起動

### backend

```bash
cd backend
npm run dev
```

### frontend

```bash
cd frontend
npm run dev
```

## テストとコード品質チェック

backend / frontend / shared 配下を変更した場合は、該当ディレクトリで以下を実行してからコミットする。

### backend

```bash
cd backend
npm run test
npm run format
npm run lint
npm run typecheck
```

### frontend

```bash
cd frontend
npm run test
npm run format
npm run lint
npm run typecheck
```

### shared

```bash
cd shared
npm run test
npm run format
npm run lint
npm run typecheck
```

## 共通開発規約

### 開発ルール

- 作業は検証可能でレビュー観点が明確な単位に分割する。
- 関連する変更は1つのコミットにまとめる。
- 変更点に関連する自動テストを必ず実装する（既存テストでカバー済みなら追加不要）。
- コミットメッセージは簡潔で明確にする。

### Commit & Pull Request Guidelines

- Create commits with committer `"<msg>" <file...>;` avoid manual staging.
- Follow Conventional Commits + action-oriented subjects.
- Group related changes; avoid bundling unrelated refactors.
- PRs should summarize scope, note testing performed, and mention any user-facing changes or new flags.
- PR review flow: when given a PR link, review via `gh pr view` / `gh pr diff` and do not change branches.

### ブランチ戦略

- メインブランチ: `master`（または `main`）
- 性質が異なる作業は必ず新しいブランチで開始する。

#### 作業開始前チェック

- `git branch --show-current` で現在ブランチを確認する。
- 作業のタスクID・目的と現在ブランチ名の一致を確認する。
- 不一致の場合は `git switch -c <type>/<task-id>-<summary>` で新規ブランチを作成する。

#### コミット前チェック

- `git status --short` で意図しない変更の混入がないことを確認する。
- 別タスク由来の変更が混入している場合はコミットせず、ブランチを分割して整理する。

## 仕様管理

### 機能仕様

- `docs/specs/`で管理
  - `docs/specs/000_backlog/`: アイデア段階の仕様
  - `docs/specs/NNN_feature/`: 実装着手可能な仕様（Ready以上）

### 非機能要件管理

- `docs/nfr/`で管理
  - `docs/nfr/000_backlog/`: アイデア段階のNFR
  - `docs/nfr/NNN_topic/`: 実装着手可能なNFR（Ready以上）

### 仕様に関する作業ルール

- 実装依頼の前に、対象Spec（`docs/specs/NNN_feature/spec.md`）またはNFR（`docs/nfr/NNN_topic/nfr.md`）を必ず参照する。
- Specに書いてない仕様は「未決」とみなし、ユーザーに確認する。
