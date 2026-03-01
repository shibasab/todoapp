# todoapp

TypeScript（Bun/Hono/Prisma） + React（Vite）で構成された Todo アプリケーションです。

## 技術スタック

- backend: TypeScript, Bun, Hono, Prisma, SQLite
- frontend: React, TypeScript, Vite
- shared: TypeScript（契約型・FPユーティリティ）

## バックエンドアーキテクチャ

backend は feature package ではなく、レイヤー別構成を採用しています。

```text
backend/src/
├── domain/
├── usecases/
├── ports/
├── infra/
├── http/
└── shared/
```

レイヤーの責務（要約）:

- `domain`: ADTと純粋関数によるドメインロジック
- `usecases`: ユースケース合成、`Result` ベースのエラーフロー
- `ports`: 外部依存の抽象境界
- `infra`: portsの実装詳細（Prisma/JWT等）
- `http`: 入出力境界（Hono route / validation / error mapping）

依存ルール（要約）:

- 内側のルール（`domain`）ほど外部技術への依存を持たない
- `usecases` は `ports` を経由して外部依存へアクセスする
- `http` はユースケース呼び出しに集中し、業務ロジックは持たない

詳細は `backend/docs/ARCHITECTURE.md` を参照してください。

## バックエンド実装方針

- 関数プログラミング中心、イミュータブル（`Readonly` / `readonly`）優先
- class は原則禁止（必要最小限で `infra` などに限定）
- エラーハンドリングは `Result` を標準とした ROP（Railway Oriented Programming）
- `try/catch` は境界層へ集約し、ユースケース層での常用を避ける
- ADT（直積・直和）で状態を設計し、`switch` + `assertNever` で網羅性チェックする

## 必要な環境

- Node.js 24+
- npm
- Bun（backend の開発サーバー起動に必須）

```bash
# Bun確認
bun --version

node --version
npm --version
```

## セットアップ

```bash
# リポジトリルートで
npm install
```

必要に応じて環境変数を設定します（`backend/.env.example`）。

### データベースセットアップ（backend）

backend の開発サーバー起動前に、Prisma スキーマを DB に反映する。

```bash
cd backend
DATABASE_URL="${DATABASE_URL:-file:./todo.db}" npm run prisma:db:push
```

`DATABASE_URL` が未設定の場合は `file:./todo.db` を使用する。

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

shared:

```bash
cd shared
npm run format:check
npm run lint:check
npm run typecheck
npm run test
```

ワークスペース単位で実行する場合（リポジトリルート）:

```bash
npm run test:backend
npm run test:frontend
npm run test:shared
```
