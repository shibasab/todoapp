# 型の shared 移管境界メモ（auth/todo）

## 目的

`backend/src/domain/auth/types.ts` と `backend/src/domain/todo/types.ts` を起点に、型を以下の3区分で扱う。

1. HTTP request/response 契約（API契約）
2. ユースケース内部
3. 永続化内部

本メモは、今後の `shared` への移管判断を統一するための基準である。

## 分類結果

### auth (`backend/src/domain/auth/types.ts`)

| 型 | 分類 | shared移管方針 | 根拠（参照先） |
| --- | --- | --- | --- |
| `AuthTokenResponse` | HTTP response 契約 | **移管対象** | usecase の戻り値として `http` へ返却されるレスポンス形状。 |
| `PublicUser` | HTTP response 契約（`AuthTokenResponse` の一部） | **移管対象** | `toPublicUser` で生成され、API応答に露出。 |
| `AuthValidationError` / `AuthValidationErrorReason` | HTTP 422 error 契約 | **移管対象** | `usecases/auth/errors.ts` から `http/auth/to-http-error.ts` で 422 応答へ変換。 |
| `AuthConfig` | ユースケース内部（設定） | **移管しない** | バックエンド依存の設定値。HTTP契約ではない。 |
| `AuthUserRecord` | 永続化内部（Repoレコード） | **移管しない** | `ports/auth-user-repo-port.ts` でRepo入出力として使用。 |

### todo (`backend/src/domain/todo/types.ts`)

| 型 | 分類 | shared移管方針 | 根拠（参照先） |
| --- | --- | --- | --- |
| `TodoListItem` | HTTP response 契約（公開DTO） | **移管対象** | usecase の戻り値として一覧/詳細/作成/更新のレスポンスに使用。 |
| `TodoDueDateFilter` | HTTP request 契約（検索クエリ） | **移管対象** | 一覧取得クエリ（dueDate）として境界で受け取る値。 |
| `TodoValidationError` / `TodoValidationErrorReason` | HTTP 422 error 契約 | **移管対象** | `usecases/todo/errors.ts` から `http/todo/to-http-error.ts` で 422 応答へ変換。 |
| `TodoProgressStatus` / `TodoRecurrenceType` | HTTP契約かつ内部処理で利用する列挙値 | **移管対象（API契約として定義）** | request/response 双方で露出し、frontend と整合が必要。 |
| `TodoItem` | 永続化内部（Repoレコード） | **移管しない** | `ports/todo-repo-port.ts` / `infra/todo/prisma-todo-repo-port.ts` でDB寄りデータとして使用。 |

## domain 以外の型定義の確認結果

`backend/src/http`, `backend/src/usecases`, `backend/src/ports` の型定義も確認し、HTTPレイヤのインタフェースが `shared` 移管対象かを判定した。

| 型（定義場所） | 分類 | shared移管方針 | 判定理由 |
| --- | --- | --- | --- |
| `AuthHttpRouteDependencies`, `TodoHttpRouteDependencies`（`http/*/routes.ts`） | HTTP実装のDI型 | **移管しない** | `PrismaClient` や `AuthConfig` を含むサーバー組み立て専用型で、外部公開契約ではない。 |
| `JsonResponder`（`http/shared/request-utils.ts`） | HTTP実装ユーティリティ型 | **移管しない** | Hono `context.json` の抽象化であり、API契約そのものではない。 |
| `HttpError`（`http/*/to-http-error.ts`） | HTTP変換の内部表現 | **移管しない** | usecaseエラーをレスポンスへマッピングするための内部中間型。 |
| `RegisterInput`, `LoginInput`, `CreateTodoInput` 等（`usecases/*/types.ts`） | ユースケース入力契約 | **原則移管しない** | HTTP body と近いが、usecase層都合（`userId` 付与など）を含み得るため backend 境界に留める。 |
| `TodoQuery`, `CreateTodoRecordInput` 等（`ports/*`） | 永続化ポート契約 | **移管しない** | Repo実装差し替えのための内部ポート契約で、クライアント公開対象ではない。 |

補足:

- `http/*/schemas.ts` の Zod スキーマは request 検証ロジックであり、現状は型エクスポートしていない。
- ここから `z.infer` で公開型を切り出す場合のみ、API契約として `shared` 移管対象の候補になる。

## shared 移管の原則

- `shared` に移すのは **API境界を越える型（HTTP request/response 契約）に限定**する。
  - 例: `AuthTokenResponse` 相当、Todo公開DTO、検索クエリ、422エラー応答。
- 次は **backend 内に残す**。
  - 永続化寄りの内部表現（例: `TodoItem`, `AuthUserRecord`）
  - Repo port の入出力専用型
  - バックエンド設定・内部ユースケース都合の型
  - HTTPルーティング実装のDI/補助型（`*HttpRouteDependencies`, `JsonResponder`, `HttpError`）

## 参照整合チェック（`rg`）

次の確認コマンドで、分類と実装参照の矛盾がないことを確認した。

```bash
rg -n "AuthTokenResponse|PublicUser|AuthUserRecord|AuthValidationError|TodoItem|TodoListItem|TodoValidationError|TodoDueDateFilter|TodoProgressStatus|TodoRecurrenceType" backend/src shared frontend/src docs -g '!**/node_modules/**'
rg -n "AuthHttpRouteDependencies|TodoHttpRouteDependencies|JsonResponder|HttpError|RegisterInput|LoginInput|ListTodosInput|CreateTodoInput|TodoQuery|CreateTodoRecordInput|UpdateTodoRecordInput" backend/src shared frontend/src -g '!**/node_modules/**'
rg -n "422|ValidationError|ErrorResponse|AuthTokenResponse|TodoListItem|TodoSearch|query|contract" shared backend/src/http backend/src/usecases backend/src/domain -g '!**/node_modules/**'
```

確認観点:

- `AuthUserRecord` / `TodoItem` は ports・infra 中心で利用され、永続化内部型として整合。
- `AuthTokenResponse` / `TodoListItem` は usecase 戻り値・HTTP応答として利用され、公開契約型として整合。
- `AuthValidationError` / `TodoValidationError` は 422 応答へ変換され、エラー契約型として整合。
- `AuthHttpRouteDependencies` / `TodoHttpRouteDependencies` / `JsonResponder` / `HttpError` は `http` 実装内で閉じて利用され、公開契約型ではないことを確認。
