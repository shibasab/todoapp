---
name: nfr-promote-ready
description: BacklogのIdeaを、実装着手可能なNFR（Ready）として docs/nfr/NNN_topic/nfr.md に昇格し、docs/nfr/INDEX.md を更新する。実装は行わず、ドキュメント作成と索引更新のみを行う。Use when the user wants to promote a backlog NFR idea to Ready status for implementation.
---

# NFR: Promote Idea -> Ready

BacklogのIdeaを、実装着手可能なNFR（Ready）として `docs/nfr/NNN_topic/nfr.md` に昇格し、`docs/nfr/INDEX.md` を更新する。実装はしない。

## Goal

実装前に、要件・仕様（WHAT/WHY）と受け入れ条件を明確化し、エージェントが参照できる形にする。

## Inputs (ユーザーが埋める)

- Source Idea: docs/nfr/000_backlog/<slug>.md
- NFR folder: <NNN>_<topic>（未指定なら提案して。例: 001_api_response_time）
- 追加で確定させたい仕様: <あれば>
- 受け入れ条件として必ず入れたい観点: <あれば>

## Rules

- 実装はしない（ドキュメント作成と索引更新のみ）
- HOW（実装計画、設計、影響範囲、技術選定、コード）は nfr.md に書かない
- Requirements は NFR-001 形式で番号を振り、MUST/SHOULDで曖昧さを減らす

## Steps

### 1. Choose next NFR number

- `docs/nfr/` 配下の `NNN_` をスキャンし、次の番号を提案する（欠番は埋めない）

### 2. Create NFR folder + nfr.md

- `docs/nfr/<NNN>_<topic>/nfr.md` を作成する
- 先頭にメタ情報（Markdown）を必ず入れる:
  - Title: <Title>
  - Status: Ready
  - Quality attributes (ISO/IEC 25010): <選択した品質特性>
  - Created: <YYYY-MM-DD>
  - Last updated: <YYYY-MM-DD>
  - Source: ../000_backlog/<slug>.md

#### Body template (HOW禁止)

1. Goal（1〜2文）
2. Non-goals
3. Scenarios & Testing（Given/When/Then を最低3つ、可能なら5つ）
4. Edge Cases / Risks
5. Requirements（NFR-001, NFR-002... MUST/SHOULD形式）
6. Decision log（optional）
7. Open Questions（任意）

### 3. Update INDEX

- `docs/nfr/INDEX.md` の Ready セクションの先頭に `docs/nfr/<NNN>_<topic>/nfr.md` を追加する
- 行をReadyへ移動し、Idea側は削除する

### 4. Output

作成/更新したファイル一覧を箇条書きで出力して終了する。
