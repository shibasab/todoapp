---
name: spec-promote-ready
description: BacklogのIdeaを、実装着手可能なSpec（Ready）として specs/NNN_feature/spec.md に昇格し、specs/INDEX.md を更新する。実装は行わず、ドキュメント作成と索引更新のみを行う。Use when the user wants to promote a backlog idea to Ready status for implementation.
---

# Spec: Promote Idea -> Ready

BacklogのIdeaを、実装着手可能なSpec（Ready）として `specs/NNN_feature/spec.md` に昇格し、`specs/INDEX.md` を更新する。実装はしない。

## Goal

実装前に、要件・仕様（WHAT/WHY）と受け入れ条件を明確化し、エージェントが参照できる形にする。

## Inputs (ユーザーが埋める)

- Source Idea: specs/000_backlog/<slug>.md
- Feature folder: <NNN>_<feature>（未指定なら提案して。例: 012_csv_export）
- 追加で確定させたい仕様: <あれば>
- 受け入れ条件として必ず入れたい観点: <あれば>

## Rules

- 実装はしない（ドキュメント作成と索引更新のみ）
- HOW（実装計画、設計、影響範囲、技術選定、コード）は spec.md に書かない
- Requirements は FR-001 形式で番号を振り、MUST/SHOULDで曖昧さを減らす

## Steps

### 1. Choose next feature number

- `specs/` 配下の `NNN_` をスキャンし、次の番号を提案する（欠番は埋めない）

### 2. Create feature folder + spec

- `specs/<NNN>_<feature>/spec.md` を作成する
- 先頭にメタ情報（Markdown）を必ず入れる:
  - Title: <Title>
  - Status: Ready
  - Created: <YYYY-MM-DD>
  - Last updated: <YYYY-MM-DD>
  - Source: ../000_backlog/<slug>.md

#### Body template (HOW禁止)

1. Goal（1〜2文）
2. Non-goals
3. User Scenarios & Testing（Given/When/Then を最低3つ、可能なら5つ）
4. Edge Cases
5. Requirements
   - Functional Requirements（FR-001, FR-002...）
   - Non-functional Requirements（必要なら）
6. Open Questions（任意）

### 3. Update INDEX

- `specs/INDEX.md` の Ready セクションの先頭に `specs/<NNN>_<feature>/spec.md` を追加する
- 行をReadyへ移動し、Idea側は削除する

### 4. Run spec review agent and refine spec

- 作成した`spec.md` の仕様に関して複数観点でレビューを実施する
  - **UX/UI観点**: `ux-psychology` スキルを使用する
- レビュー結果を `specs/<NNN>_<feature>/design-review.md` に記録する
  - 最低限含める項目:
    - Review Scope
    - Findings（Critical / Major / Minor）
    - 改善提案（実施可否と理由）
- Findings のうち、仕様として確定すべきものは `spec.md` に反映する
  - 反映した変更は `Last updated` を更新する
  - HOW（実装手段）には踏み込まず、要件・受け入れ条件として明文化する
- 反映しなかった提案は `design-review.md` に「見送り理由」を記載する

### 5. Output

作成/更新したファイル一覧を箇条書きで出力して終了する。
