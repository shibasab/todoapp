# AGENTS.md

## 基本ルール

すべてのユーザーとのコミュニケーションは**日本語**で行う。これには以下が含まれる。

- コードレビューコメントとフィードバック
- コミットメッセージ
- PRのタイトルと本文
- エラー説明とデバッグ支援
- ドキュメントと実装説明
- 一般的な応答と会話

**例外**: コメントの中では、コードの中で使用されている変数名や技術用語は英語を使用しても良い。

## ディレクトリ構成

```shell
todoapp/
├── backend/
├── frontend/
├── shared/
└── docs/
```

- **backend**: バックエンドのコードが格納されているディレクトリ
- **frontend**: フロントエンドのコードが格納されているディレクトリ
- **shared**: backend / frontend で共通利用する型・Resultユーティリティ
- **docs**: ドキュメントが格納されているディレクトリ

### backend/src レイヤー構成（現行）

```shell
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

- **domain**: 型（ADT）と純粋関数によるドメインロジック
- **usecases**: ユースケース合成、Resultチェーン、ユースケースエラー
- **ports**: 外部依存の抽象インターフェース（Repo/Clock等）
- **infra**: portsの具体実装（Prisma/JWT/DB接続等）
- **http**: Hono route、バリデーション、HTTPエラー変換
- **shared**: backend内共通（網羅性チェック補助など）

### backend レイヤー依存ルール

- `domain` は他レイヤーに依存しない（外部FW・DB依存禁止）
- `usecases` は `domain` / `ports` / `shared` / `@todoapp/shared` に依存可能
- `ports` は契約定義に限定し、実装詳細（Prisma等）に依存しない
- `infra` は `ports` を実装し、外部ライブラリ依存を閉じ込める
- `http` は入出力境界に集中し、業務ロジックを持たない
- `app.ts` で依存を組み立てる（Composition Root）

## 開発環境セットアップ

## 開発環境の事前準備

### backend

バックエンドのセットアップ前に、以下をインストールすること。

- Node.js 24+
- npm
- Bun（`backend` の開発サーバー起動に必須）

```bash
# Node.js / npm確認
node --version
npm --version
```

### frontend

フロントエンドのセットアップ前に、以下をインストールすること。

- Node.js（LTS推奨）
- npm

```bash
# Node.js / npm確認
node --version
npm --version
```

Node.js未インストールの場合は公式サイトを参照: https://nodejs.org/

### backend

```bash
# リポジトリルートで
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

## テストとコード品質

**重要**: backend, frontendディレクトリ配下の実装を変更した場合、以下は必ずコミット前に実行し、テストが成功していること・フォーマット済みであること・静的解析でエラーがないことを確認してからコミットする。

### backend

```bash
cd backend
# テスト
npm run test
# フォーマット
npm run format
# 静的解析
npm run lint
npm run typecheck
```

### frontend

```bash
cd frontend
# テスト
npm run test
# フォーマット
npm run format
# 静的解析
npm run lint
npm run typecheck
```

### shared

```bash
cd shared
# テスト
npm run test
# フォーマット
npm run format
# 静的解析
npm run lint
npm run typecheck
```

## 共通開発規約

### 開発ルール

以下のルールを必ず守ること:

- 作業は検証可能でレビュー観点が明確な単位に分割する
  - 一つの作業に機能追加・既存修正・リファクタリングが含まれる場合は作業を分割する
- 関連する変更は1つのコミットにまとめる
- 変更点に関連する自動テストを必ず実装する。
  - 既存のテストでカバーできている場合はテスト追加不要
  - 変更とそのテストは一つのPRにまとめる
- コミットメッセージは簡潔で明確に

### バックエンド実装方針（TypeScript移行後）

- 関数プログラミング中心で実装し、宣言的な記述を優先する
- データはイミュータブルを基本とし、`Readonly` / `readonly` を積極利用する
- class は原則禁止。必要最小限で `infra` などに限定して使用する
- エラーハンドリングは `Result` を標準とし、ROP（Railway Oriented Programming）で処理を合成する
- `try/catch` は境界層（主に `infra`・HTTP入力境界）へ集約し、`usecases` での常用は避ける
- データの状態表現は ADT（直積・直和）で設計する
- 直和型の分岐は `switch` と `assertNever` による網羅性チェックを行う

### Commit & Pull Request Guidelines

- Create commits with `committer "<msg>" <file...>;` avoid manual staging.
- Follow Conventional Commits + action-oriented subjects (e.g. `feat(cli): add --verbose to send).`
- Group related changes; avoid bundling unrelated refactors.
- PRs should summarize scope, note testing performed, and mention any user-facing changes or new flags.
- PR review flow: when given a PR link, review via gh pr view / gh pr diff and do not change branches.


### ブランチ戦略

- **メインブランチ**: `master`（または`main`）
- **原則**: 性質が異なる作業は必ず新しいブランチで開始する

#### 性質が異なる作業の判定基準

- 対象のSpec / NFR / Issue / チケットが異なる
- 目的が異なる（機能追加 / 不具合修正 / リファクタリング / ドキュメント整備）
- 主に変更する責務やディレクトリが異なる

#### 作業開始前チェック（必須）

- `git branch --show-current` で現在ブランチを確認する
- 今回作業のタスクID・目的と、現在ブランチ名が一致しているか確認する
- 不一致の場合は作業前に `git switch -c <type>/<task-id>-<summary>` で新規ブランチを作成する

#### コミット前チェック（必須）

- `git status --short` で意図しない変更の混入がないことを確認する
- 別タスク由来の変更が混入している場合はコミットせず、ブランチを分割して整理する

#### 並行作業時の推奨

- 並行して複数タスクを扱う場合は `git worktree` で作業ディレクトリを分離する
- ブランチ切り替え時に未コミット変更がある場合は、先に整理してから切り替える

## 仕様管理

### 機能仕様

- `docs/specs/`で管理
  - `docs/specs/000_backlog/`: アイデア段階の仕様
  - `docs/specs/NNN_feature/`: 実装着手可能な仕様（Ready以上）
- 管理方法の詳細は `docs/spec-workflow.md` を参照

### 非機能要件管理

- **NFR**: `docs/nfr/`で管理
  - `docs/nfr/000_backlog/`: アイデア段階のNFR
  - `docs/nfr/NNN_topic/`: 実装着手可能なNFR（Ready以上）
- 管理方法の詳細は `docs/nfr-workflow.md` を参照

### 仕様に関する作業ルール

- 実装依頼の前に、対象Spec（`specs/NNN_feature/spec.md`）またはNFR（`nfr/NNN_topic/nfr.md`）を必ず参照する
- Specに書いてない仕様は「未決」とみなし、ユーザーに確認する
