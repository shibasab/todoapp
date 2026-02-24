# Backend Architecture

## 概要

backend は TypeScript で実装し、Bun/Hono/Prisma を利用する。  
アーキテクチャは `domain`, `usecases`, `ports`, `infra`, `http` のレイヤー分離を基準にする。

## 現在のソース構成（`backend/src`）

```text
backend/src/
├── app.ts
├── server.ts
├── domain/
│   ├── auth/
│   └── todo/
├── usecases/
│   ├── auth/
│   └── todo/
├── ports/
├── infra/
│   ├── auth/
│   ├── prisma/
│   └── todo/
├── http/
│   ├── auth/
│   └── todo/
├── shared/
│   └── error.ts
```

`Result` 系ユーティリティは workspace 共通パッケージ `shared/src/fp/result.ts` を `@todoapp/shared` として利用する。

## レイヤー責務

### `domain/*`

- 型（直積/直和）と純粋関数で業務ルールを表現する。
- フレームワークやDB、HTTPに依存しない。
- class は使用しない。

### `usecases/*`

- ユースケース単位で処理を合成する。
- `Result` を使って成功/失敗の分岐を明示する（ROP）。
- トランザクション境界・ユースケースエラー変換を担う。

### `ports/*`

- 外部依存（Repository, Clock など）の抽象インターフェースを定義する。
- `usecases` から見える「契約」を提供する。

### `infra/*`

- `ports` の具体実装を提供する（Prisma, JWT, DB接続など）。
- 外部ライブラリ依存を閉じ込める。
- class が必要な場合はこの層で最小限に許可する。

### `http/*`

- Hono ルーティング、入力バリデーション、HTTPエラー変換を担当する。
- ユースケース呼び出しとレスポンス組み立てに集中し、業務ロジックは持たない。

### `shared/*`（backend内）

- レイヤー横断で使う最小共通要素を置く。
- 現在は網羅性チェック支援 (`assertNever`, `createNotExhaustiveError`) を提供する。

## 依存ルール

| From | 依存可能 |
| --- | --- |
| `domain` | `domain` 内のみ（外部FW非依存） |
| `usecases` | `domain`, `ports`, `shared`, `@todoapp/shared` |
| `ports` | `domain` の型、`@todoapp/shared` の型 |
| `infra` | `ports`, `domain`, `shared`, `@todoapp/shared`, 外部ライブラリ |
| `http` | `usecases`, `shared`, `infra` |
| `app.ts` | `http`, `infra` |

### 禁止事項

- `domain` から `infra` / `http` / Prisma 等へ直接依存しない。
- `usecases` が Prisma クエリ等の永続化詳細を直接扱わない。
- `http` にドメインルールや永続化ロジックを書かない。

## 実装方針（規約）

### 1. 関数プログラミング中心

- 可能な限り純粋関数で実装する。
- 副作用は `infra` や `http` などの境界に閉じ込める。

### 2. イミュータブル + 宣言的

- 型は `Readonly` / `readonly` を優先する。
- 破壊的更新より、値の変換・合成を選ぶ。

### 3. エラーハンドリングは `Result` を標準化

- 正常系/異常系は `Result` で表現する。
- `try/catch` は例外発生源に近い境界（主に `infra`, `http` 入力境界）へ集約する。
- `usecases` は `Result` チェーンを優先し、`try/catch` の常用を避ける。

### 4. ADT と網羅性チェック

- データの取りうる状態は直和型で表現する。
- 分岐時は `switch` + `assertNever` で網羅性を担保する。

```ts
switch (recurrenceType) {
  case "daily":
    return "...";
  case "weekly":
    return "...";
  case "monthly":
    return "...";
  case "none":
    return "...";
  default:
    return assertNever(recurrenceType, "TodoRecurrenceType");
}
```

### 5. class 利用制限

- 原則 class は禁止。
- 例外は `infra` 等で、ライブラリ制約や実装上の必然がある場合のみ許可する。
