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
└── docs/
```

- **backend**: バックエンドのコードが格納されているディレクトリ
- **frontend**: フロントエンドのコードが格納されているディレクトリ
- **docs**: ドキュメントが格納されているディレクトリ

## 開発環境セットアップ

## 開発環境の事前準備

### backend

バックエンドのセットアップ前に、以下をインストールすること。

- Node.js 24+
- npm
- Bun（任意。未導入時は `npm` 経由でテスト実行可能）

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
cd backend
npm install
```

### frontend

```bash
cd frontend
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

### Commit & Pull Request Guidelines

- Create commits with `committer "<msg>" <file...>;` avoid manual staging.
- Follow Conventional Commits + action-oriented subjects (e.g. `feat(cli): add --verbose to send).`
- Group related changes; avoid bundling unrelated refactors.
- PRs should summarize scope, note testing performed, and mention any user-facing changes or new flags.
- PR review flow: when given a PR link, review via gh pr view / gh pr diff and do not change branches.


### ブランチ戦略

- **メインブランチ**: `master`（または`main`）

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
