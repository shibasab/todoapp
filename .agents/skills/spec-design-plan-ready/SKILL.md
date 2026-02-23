---
name: spec-design-plan-ready
description: Ready状態のSpecを実装着手できる詳細設計と実装計画へ落とし込み、設計レビュー（シニアエンジニア観点）と計画レビュー（実装者観点）まで実施する。Use when the user wants to prepare implementation-ready design docs and task breakdown from docs/specs/NNN_feature/spec.md before coding.
---

# Spec: Design + Implementation Plan for Ready Spec

Ready状態のSpecをもとに、実装前の詳細設計と実装計画を作成する。必要に応じてレビュー役のエージェント視点で内容を批評し、修正を反映して着手可能な状態にする。実装はしない。

## Goal

- 仕様（WHAT/WHY）を実装可能な設計（HOW）へ具体化する
- 実装順・テスト順を明確にした計画へ分解する
- 設計と計画の抜け漏れを、レビュー観点で事前に減らす
- 実装計画をPR単位まで分解し、各PRで「変更内容」と「自動テスト」をセットで定義する

## Inputs (ユーザーが埋める)

- Target Spec: `docs/specs/NNN_feature/spec.md`
- Scope: `backend` / `frontend` / `both`
- 設計に反映したい制約: <任意>
- 計画の粒度: `PR単位` / `タスク単位` / `チェックリスト単位`

## Rules

- 実装コードは変更しない（ドキュメント作成・更新のみ）
- Specにない事項は推測で確定せず、`Open Questions` に残す
- 設計と計画は `Spec要件ID -> 設計要素 -> タスク/テスト` の対応を示す
- 影響範囲はファイル単位で明記する
- `implementation-tasks.md` には `PR分割（実装順）` セクションを必ず含める
- `implementation-tasks.md` には、既存タスクの進捗をひと目で判別できる `タスク管理` セクションを必ず含める（各タスク先頭に `[ ]` / `[x]` もしくは `未完了` / `完了` を明記）
- 各PRは「変更」と「その変更を検証する自動テスト」を同一PRに含める
- 新規テストが不要な場合は、既存テストでカバーできる根拠（対象テストケース）をPR計画内に明記する
- `design.md` には、以下を必須で含める
  - 機能を適切に表現するUML（最低1種類、必要最小限）
  - 検討した設計方針（採用/不採用の理由付き）
- DBテーブルの追加/更新がある場合、`design.md` にスキーマ情報（テーブル/カラム/制約/インデックス/マイグレーション方針）を必ず含める
- UMLは「実装検討・レビュー・将来運用」に有効な最小セットを選定し、なぜその図を選んだかを明記する
- レビューでは必ず「指摘（重要度付き）」「判断理由」「修正方針」を残す
- レビューで重大な未解決事項がある場合は、未解決のまま実装計画を確定しない

## Steps

### 1. Read and pin the baseline

- `Target Spec` を読み、以下を抽出する
  - Goal / Non-goals
  - User Scenarios & Testing
  - Edge Cases
  - FR/NFR（MUST/SHOULD）
- 要件チェックリスト（要件ID付き）を作る

### 2. Gather implementation context

- `backend/AGENTS.md`, `frontend/AGENTS.md`, 各 `ARCHITECTURE.md` を確認する
- 既存コードと既存テストから関連箇所を抽出する
- 既存制約（DB制約、API契約、UI状態管理、テスト構造）を整理する

### 3. Draft detailed design document

- `docs/specs/NNN_feature/design.md` を作成/更新する
- 最低限含める
  - 要件トレース（FR/NFR対応）
  - UMLセクション（必須）
    - 最低1つのUML図（例: シーケンス図、状態遷移図、クラス図、コンポーネント図）
    - 図の選定理由（なぜその図がこの機能に必要十分か）
    - テキスト形式（Mermaid/PlantUML等）で管理し、レビューしやすくする
  - 設計方針の比較セクション（必須）
    - 検討した候補（最低2案）
    - 採用案と不採用案の判断理由（トレードオフ）
  - データ/モデル/API/UI/バリデーション設計
  - スキーマ設計（DBテーブル追加/更新がある場合は必須）
    - 変更対象テーブル
    - 追加/変更カラム（型、NULL可否、default）
    - 制約・インデックス・外部キー
    - 既存データへの影響とマイグレーション方針
  - 例外・エラー設計
  - テスト設計（backend/frontend）
  - 影響範囲・移行方針
  - 未決事項

### 4. Run design review (senior engineer perspective)

- シニアエンジニア観点でレビューする（可能ならレビュー専用エージェントを立てる）
- 観点
  - 要件適合性、アーキテクチャ整合、パフォーマンス、セキュリティ、拡張性、運用リスク、テスタビリティ
  - UMLの適切性（過不足、読みやすさ、保守性）
  - スキーマ変更の妥当性（制約、互換性、運用リスク）
  - 設計方針比較の妥当性（判断根拠が十分か）
- `docs/specs/NNN_feature/design-review.md` を作成/更新する
- 指摘は重要度順（High/Medium/Low）で記録する
- 指摘反映後、`design.md` を更新する

### 5. Draft implementation plan

- `docs/specs/NNN_feature/implementation-tasks.md` を作成/更新する
- 最低限含める
  - タスク管理セクション
    - タスク一覧（各タスク先頭に `[ ]` / `[x]` もしくは `未完了` / `完了` を付与）
    - 状態は簡潔で視認性の高い表記に統一する（例: `[x] API実装` / `[ ] UI実装`）
    - 必要に応じてブロッカー/依存関係
  - フェーズ分割（Backend / Frontend / Test / Verification）
  - 各タスクの対象ファイル
  - 完了条件（Definition of Done）
  - 実行・検証コマンド
  - PR分割（実装順）
    - 各PRの目的
    - 各PRの変更内容（対象ファイル）
    - 各PRに含める自動テスト（新規追加 / 既存更新 / 既存流用）
    - 各PRの検証コマンド
    - 新規テスト不要時の根拠

### 6. Run plan review (implementer perspective)

- 実装者観点でレビューする（可能なら実装担当エージェント視点でレビュー）
- 観点
  - タスク粒度、タスクの明確性、着手順、依存関係、手戻りリスク、テスト容易性
  - PR粒度の妥当性、PR間依存の最小化、各PRのレビュー容易性
  - 各PRで「変更 + 自動テスト」が成立しているか
- `docs/specs/NNN_feature/implementation-plan-review.md` を作成/更新する
- 指摘反映後、`implementation-tasks.md` を更新する

### 7. Final consistency check

- `spec.md` / `design.md` / `implementation-tasks.md` の整合を確認する
- 要件IDごとに「設計済み」「計画済み」「未決」を示す
- PRごとに要件IDとの対応（どの要件を満たすPRか）を示す
- `design.md` に必須セクション（UML / 設計方針比較 / [該当時]スキーマ情報）が揃っていることを確認する
- 追加で合意が必要な論点は `Open Questions` に戻す

### 8. Output

- 以下を簡潔に報告して終了する
  - 作成/更新したファイル一覧
  - レビューでの主要指摘と反映結果
  - PR分割結果（PRごとの変更点とテスト方針）
  - 未解決事項（あれば）
