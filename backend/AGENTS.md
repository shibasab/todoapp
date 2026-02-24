# Backend AGENTS.md

backend モジュールは TypeScript + Bun + Hono + Prisma で実装されています。

## セットアップ

```bash
cd backend
npm install
```

## 開発サーバー

```bash
cd backend
npm run dev
```

## 品質チェック

backend 配下を変更した場合は、コミット前に以下を実行してください。

```bash
cd backend
npm run format:check
npm run lint:check
npm run typecheck
npm run test
npm run test:coverage
```

## 構成

```text
backend/
├── prisma/                 # Prisma schema
├── src/
│   ├── app.ts              # Honoアプリ組み立て
│   ├── server.ts           # Bunサーバー起動
│   ├── auth/               # 認証API
│   ├── todo/               # Todo API
│   └── infra/prisma/       # Prisma補助
└── tests/                  # Vitest
```

## 実装方針

- class は原則使わず、関数中心で実装する
- 失敗系は `Result` / `TaskResult` を優先し、ルート層でHTTPへ変換する
- 変更には必ず関連する自動テストを同梱する
