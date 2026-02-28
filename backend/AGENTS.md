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
npm run test
npm run format
npm run lint
npm run typecheck
```

## backend/src レイヤー構成

```text
backend/src/
├── app.ts
├── server.ts
├── domain/
├── usecases/
├── ports/
├── infra/
├── http/
└── shared/
```

- `domain`: 型（ADT）と純粋関数によるドメインロジック
- `usecases`: ユースケース合成、Resultチェーン、ユースケースエラー
- `ports`: 外部依存の抽象インターフェース（Repo/Clock等）
- `infra`: ports の具体実装（Prisma/JWT/DB接続等）
- `http`: Hono route、バリデーション、HTTPエラー変換
- `shared`: backend 内共通（網羅性チェック補助など）

## backend レイヤー依存ルール

- `domain` は他レイヤーに依存しない（外部FW・DB依存禁止）
- `usecases` は `domain` / `ports` / `shared` / `@todoapp/shared` に依存可能
- `ports` は契約定義に限定し、実装詳細（Prisma等）に依存しない
- `infra` は `ports` を実装し、外部ライブラリ依存を閉じ込める
- `http` は入出力境界に集中し、業務ロジックを持たない
- `app.ts` で依存を組み立てる（Composition Root）

## 実装方針

- 関数プログラミング中心で実装し、宣言的な記述を優先する
- データはイミュータブルを基本とし、`Readonly` / `readonly` を積極利用する
- class は原則禁止。必要最小限で `infra` などに限定して使用する
- エラーハンドリングは `Result` を標準とし、ROP（Railway Oriented Programming）で処理を合成する
- `try/catch` は境界層（主に `infra`・HTTP入力境界）へ集約し、`usecases` での常用は避ける
- データの状態表現は ADT（直積・直和）で設計する
- 直和型の分岐は `switch` と `assertNever` による網羅性チェックを行う
- 変更には必ず関連する自動テストを同梱する（既存テストでカバー済みなら追加不要）

## テスト実装ルール（API / DB）

- API統合テスト（`backend/tests/*api*.test.ts` と `auth.test.ts` / `todo.test.ts`）では、`tests/support/sqlite-api-test-harness.ts` のテンプレートDB方式を使う。
- テンプレートDB方式では、スキーマ適用済みSQLiteを1回だけ作成し、各テストケースでDBファイルを複製して専用DBを使う。
- 目的は「テストケース間の独立性維持」と「`prisma db push` の繰り返し削減による実行時間短縮」の両立。
- APIテストで初期化方針を変えるときは、テストケース・アサーションを変えずに、実行時間とカバレッジの比較結果を確認してから導入する。
- `cloneTemporarySqliteDatabase` はSQLite向け最適化のため、将来PostgreSQL/MySQLへ移行する場合は同等の分離戦略（例: ワーカー単位DB）へ置き換える前提で扱う。
