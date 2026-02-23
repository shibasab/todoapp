# todoapp

TypeScript（Bun/Hono/Prisma） + React（Vite）で構成された Todo アプリケーションです。

## 技術スタック

- backend: TypeScript, Bun, Hono, Prisma, SQLite
- frontend: React, TypeScript, Vite
- shared: TypeScript（契約型・FPユーティリティ）

## 必要な環境

- Node.js 24+
- npm
- Bun（推奨。未導入でも `npm run -w backend test` は実行可能）

```bash
node --version
npm --version
```

## セットアップ

```bash
# リポジトリルートで
npm install
```

必要に応じて環境変数を設定します（`backend/.env.example`）。

## 開発サーバー起動

バックエンド:

```bash
cd backend
npm run dev
```

フロントエンド:

```bash
cd frontend
npm run dev
```

## テストと品質チェック

backend:

```bash
cd backend
npm run format:check
npm run lint:check
npm run typecheck
npm run test
npm run test:coverage
```

frontend:

```bash
cd frontend
npm run format
npm run lint
npm run typecheck
npm run test
```
