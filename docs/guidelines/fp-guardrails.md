# FP Guardrails（Backend/Shared）

TypeScript移行後の `backend/src` と `shared/src` では、関数型・ROP方針を崩さないために以下をCIで強制する。

## 対象

- `backend/src/**`
- `shared/src/**`

> `tests/**` は対象外。テストコードの記述自由度を優先する。

## 主要ルール

- `typescript/no-extraneous-class = deny`
  - `class` の利用を原則禁止する。
- `no-throw-literal = deny`
  - `throw "..."` などのliteral throwを禁止する。
- `typescript/only-throw-error = deny`
  - 例外を投げる場合は `Error` 系のみに限定する。

## 例外運用

`throw` は原則禁止。どうしても必要な場合のみ、理由付きでlint無効化コメントを使う。

```ts
// oxlint-disable-next-line no-throw-literal,typescript/only-throw-error -- 境界でHTTPエラーへ変換するため
throw "legacy-error";
```

### 例外コメントの必須要件

- `oxlint-disable-next-line` を使って最小範囲に限定する。
- 無効化理由を日本語で併記する。
- PR本文に「なぜResultで扱えないか」を説明する。
