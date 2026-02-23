---
name: nfr-add-idea
description: 新しい非機能要件アイデアを軽量NFRとして docs/nfr/000_backlog に追加し、docs/nfr/INDEX.md を更新する。実装は行わず、ドキュメント作成と索引更新のみを行う。Use when the user wants to add a new non-functional requirement idea to the backlog or create a lightweight NFR specification.
---

# NFR: Add Idea (Backlog)

新しい非機能要件アイデアを軽量NFRとして `docs/nfr/000_backlog` に追加し、`docs/nfr/INDEX.md` を更新する。実装はしない。

## Goal

将来の非機能要件（品質特性）アイデアを忘れないように、軽量NFR（WHAT/WHY中心）として保存する。

## Inputs (ユーザーが埋める)

- Title: <タイトル>
- Slug: <kebab-case。未指定ならタイトルから提案して>
- Quality attributes (ISO/IEC 25010): <Performance efficiency / Reliability / Security / Maintainability / Usability / Compatibility / Portability から選択>
- 背景/動機: <1〜3行>
- ざっくり欲しいこと: <箇条書きでOK>
- やらないこと: <あれば>
- メモ: <あれば>

## Rules

- 実装はしない（ドキュメント作成と索引更新のみ）
- HOW（実装計画、設計、影響範囲、技術選定、コード）は書かない
- 仕様に書かれていない事項は「未決」として Open Questions に残す

## Steps

### 1. Ensure files exist

- `docs/nfr/000_backlog/` がなければ作成する
- `docs/nfr/INDEX.md` がなければ作成する（Idea/Ready/In progress/Done/Abandoned の5セクションを作る）

### 2. Create lightweight idea NFR

- `docs/nfr/000_backlog/<slug>.md` を作成する
- 先頭にメタ情報（Markdown）を必ず入れる:
  - Title: <Title>
  - Status: Idea
  - Quality attributes (ISO/IEC 25010): <選択した品質特性>
  - Created: <YYYY-MM-DD>
  - Last updated: <YYYY-MM-DD>

#### Body template

- Goal（1〜2文）
- Non-goals（箇条書き）
- Acceptance criteria（箇条書き、粗くてOK）
- Notes（任意）
- Open Questions（任意）

### 3. Update INDEX

- `docs/nfr/INDEX.md` の Idea セクションの先頭に1行追加（新しいものが上）
- 例:
  - `- [<Title>](000_backlog/<slug>.md) (Status: Idea, Created: YYYY-MM-DD)`

### 4. Output

作成/更新したファイル一覧を箇条書きで出力して終了する。
