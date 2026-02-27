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

## 仕様確認

- 実装前に対象仕様を確認する。
  - 機能仕様: `docs/specs/NNN_feature/spec.md`
  - 非機能要件: `docs/nfr/NNN_topic/nfr.md`
- 仕様に未記載の内容は未決事項としてユーザー確認する。

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
