---
name: spec-add-idea
description: 新しい機能アイデアを軽量Specとして specs/000_backlog に追加し、specs/INDEX.md を更新する。実装は行わず、ドキュメント作成と索引更新のみを行う。Use when the user wants to add a new feature idea to the backlog or create a lightweight specification.
---

# Spec: Add Idea (Backlog)

新しい機能アイデアを軽量Specとして `specs/000_backlog` に追加し、`specs/INDEX.md` を更新する。実装はしない。

## Goal

将来の機能アイデアを忘れないように、軽量Spec（WHAT/WHY中心）として保存する。

## Inputs (ユーザーが埋める)

- Title: <タイトル>
- Slug: <kebab-case。未指定ならタイトルから提案して>
- 背景/動機: <1〜3行>
- 想定ユーザー: <任意>
- ざっくり欲しいこと: <箇条書きでOK>
- やらないこと: <あれば>
- メモ: <あれば>

## Rules

- 実装はしない（ドキュメント作成と索引更新のみ）
- HOW（実装計画、設計、影響範囲、技術選定、コード）は書かない
- 仕様に書かれていない事項は「未決」として Open Questions に残す

## Steps

### 1. Ensure files exist

- `specs/000_backlog/` がなければ作成する
- `specs/INDEX.md` がなければ作成する（Idea/Ready/In progress/Done/Abandoned の5セクションを作る）

### 2. Create lightweight idea spec

- `specs/000_backlog/<slug>.md` を作成する
- 先頭にメタ情報（Markdown）を必ず入れる:
  - Title: <Title>
  - Status: Idea
  - Created: <YYYY-MM-DD>
  - Last updated: <YYYY-MM-DD>

#### Body template

- Goal（1〜2文）
- User story（箇条書き 1〜3）
- Non-goals（箇条書き）
- Acceptance criteria（箇条書き、粗くてOK）
- Notes（任意）
- Open Questions（任意）

### 3. Update INDEX

- `specs/INDEX.md` の Idea セクションの先頭に1行追加（新しいものが上）
- 例:
  - `- [<Title>](000_backlog/<slug>.md) (Status: Idea, Created: YYYY-MM-DD)`

### 4. Output

作成/更新したファイル一覧を箇条書きで出力して終了する。
