---
name: spec-reconcile-implementation
description: 実装完了後に対象Specと現在実装を照合し、差分を実装または仕様の修正で解消し、docs/specs/INDEX.mdまで同期する。Use when the user asks to compare spec vs implementation after coding, close gaps on either side, and update INDEX.
---

# Spec: Reconcile After Implementation

実装完了後に、対象Specと現在実装を比較し、ずれや漏れを解消する。必要に応じて実装・テスト・仕様書を修正し、`docs/specs/INDEX.md` を同期する。

## Goal

- 「仕様どおりに動く」または「実装どおりに仕様が定義される」状態を作る
- 差分を放置せず、レビュー可能な単位で収束させる

## Inputs (ユーザーが埋める)

- Target Spec: `docs/specs/NNN_feature/spec.md`
- Scope: `backend` / `frontend` / `both`
- 修正方針: `実装を仕様へ合わせる` / `仕様を実装へ合わせる` / `差分ごとに判断`
- 期限・優先度: <任意>

## Rules

- 差分は必ず `Spec項目 -> 実装箇所 -> テスト` の対応で説明する
- 「未決」を勝手に実装しない。未決は Open Questions に戻すかユーザー確認
- 仕様修正のみで済む場合も、`Last updated` と `docs/specs/INDEX.md` を更新する
- 実装を変更した場合は、関連テストを追加/更新し、必要な品質コマンドを実行する
- 変更は検証可能でレビューしやすい単位に分割する

## Steps

### 1. Spec基準を固定する

- 対象 `spec.md` を読み、以下を抽出する
  - User Scenarios & Testing
  - Edge Cases
  - Functional / Non-functional Requirements（FR/NFR）
- 要件ID（`FR-001` 形式）ごとにチェックリスト化する

### 2. 実装とテストを収集する

- 対象機能に関連する実装を横断して読む
  - `backend/app/**`, `frontend/src/**`
- 関連テストを収集する
  - `backend/tests/**`, `frontend/tests/**`
- 可能なら既存テストを実行し、現状の事実（pass/fail）を確認する

### 3. 差分を分類する

- 各要件を以下で分類する
  - `一致`: 実装・テストとも整合
  - `実装不足`: Specにあるが実装/テストが不足
  - `仕様不足`: 実装済みだがSpec記述が不足/不正確
  - `解釈差`: 文言の曖昧さで判断が割れる
- 優先度順（高: MUST/不具合、低: SHOULD/表現差）で並べる

### 4. 修正方針を確定する

- 指定方針に従って差分を解消する
  - `実装を仕様へ合わせる`: コードとテストを修正
  - `仕様を実装へ合わせる`: `spec.md` を修正
  - `差分ごとに判断`: 各差分に解消先を明記して進める

### 5. 実装修正がある場合

- 実装とテストを同一変更セットで更新する
- 影響範囲に応じて最小限+関連のテストを実行する
- 必要に応じて以下を実行する
  - backend: `uv run pytest`, `uv run ruff format`, `uv run ruff check`, `uv run pyrefly check`
  - frontend: `npm run test`, `npm run format`, `npm run lint`, `npm run typecheck`

### 6. 仕様修正がある場合

- `docs/specs/NNN_feature/spec.md` を実態に合わせて更新
- 更新時は最低限以下を反映
  - `Last updated`
  - 差分が出た項目（Scenario, FR/NFR, Edge Case など）
- `docs/specs/INDEX.md` の対象行の日付を同期する

### 7. 完了確認

- 最終的な整合を `要件ID単位` で再確認する
- 未解決項目があれば `Open Questions` または報告に明記する

### 8. Output

- 以下を簡潔に報告する
  - 差分一覧（重要度順、要件ID付き）
  - 解消方法（実装修正 / 仕様修正）
  - 変更ファイル一覧
  - 実行したテスト/品質コマンド結果
  - 残課題（あれば）
