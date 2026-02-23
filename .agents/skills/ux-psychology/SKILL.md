---
name: ux-psychology
description: UX心理学の原則に基づき、課題整理から改善案・検証計画までを一貫して支援する。ユーザー行動の理解と認知負荷の低減を重視する。
---

# UX Psychology Skill

## When to use

- UI/UX改善や機能追加の設計レビューで、UX心理学の観点から判断・根拠づけを行いたいとき
- 既存仕様の改善点を洗い出す際に、UX心理学に基づく評価軸・指針が必要なとき

## Inputs

- 対象プロダクト/機能:
- 主要ユーザー:
- 主要タスク（1〜3）:
- 現状の課題/痛み:
- 制約（技術・運用・法規など）:
- 既存データ（あれば）:

## Outputs

- 課題整理（現状の阻害要因と文脈）
- 心理学原則に基づく原因仮説
- 具体的な改善案（UI/文言/フロー）
- 設計レビュー観点（合否やリスクの判断軸）
- 検証計画（指標/手法）
- 未決事項

## Instructions

1. 入力情報を要約し、主要タスクと課題を列挙する
2. 課題ごとに関連する心理学原則をマッピングし、原因仮説を立てる
3. 課題ごとに1〜3案の改善を提示する（画面要素・情報設計・文言・行動誘導を具体化）
4. 設計レビュー観点として、改善案の妥当性・リスク・代替案を簡潔に示す
5. 検証可能な指標と手法（例: 完了率、離脱率、所要時間、誤操作数、A/Bテスト、ユーザビリティテスト）を提示する
6. 仕様に書かれていない事項は「未決事項」として明示する
7. 参照元の内容と齟齬がないか、必要に応じてユーザーに確認する

## UX心理学の観点（確認リスト）

- 美的ユーザビリティ効果 (Aesthetic-Usability Effect)
- アンカー効果 (Anchor Effect)
- バナー・ブラインドネス (Banner Blindness)
- 認知負荷 (Cognitive Load)
- 確証バイアス (Confirmation Bias)
- 好奇心ギャップ (Curiosity Gap)
- 決断疲れ (Decision Fatigue)
- おとり効果 (Decoy Effect)
- デフォルト効果 (Default Bias)
- ドハティの閾値 (0.4秒の壁)
- 共感ギャップ (Empathy Gap)
- 授かり効果 (Endowment Effect)
- 期待バイアス (Expectation Bias)
- 親近性バイアス (Familiarity Bias)
- 段階的要請 (Foot in the Door Effect)
- フレーミング効果 (Framing)
- ゲーミフィケーション (Gamification)
- 目標勾配効果 (Goal Gradient Effect)
- ハロー効果 (Halo Effect)
- 観察効果 (Hawthorne Effect)
- 意図的な壁 (Intentional Friction)
- 労働の錯覚 (Labor Illusion)
- 損失回避 (Loss Aversion)
- ナッジ効果 (Nudge)
- ピーク・エンドの法則 (Peak-End Rule)
- プライミング効果 (Priming)
- 段階的開示 (Progressive Disclosure)
- ピグマリオン効果 (Pygmalion Effect)
- 誘導抵抗 (Reactance)
- 反応型オンボーディング (Reactive Onboarding)
- 希少性効果 (Scarcity)
- 選択的注意 (Selective Attention)
- 系列位置効果 (Serial Position Effect)
- スキューモーフィズム (Skeuomorphism)
- 社会的証明 (Social Proof)
- サンクコスト効果 (Sunk Cost Effect)
- 調査バイアス (Survey Bias)
- 誘惑の結びつけ (Temptation Bundling)
- ユーザー歓喜効果 (User Delight)
- 変動型報酬 (Variable Reward)
- ビジュアル・アンカー (Visual Anchor)
- 視覚的階層 (Visual Hierarchy)
- ツァイガルニク効果 (Zeigarnik Effect)

## Output template

```
## 課題整理
- ...

## 心理学原則と原因仮説
- 課題A: 原則X → 仮説...

## 改善案
- 課題A:
  - 案1: ...
  - 案2: ...

## 設計レビュー観点
- 妥当性:
- リスク:
- 代替案:

## 検証計画
- 指標:
- 手法:

## 未決事項
- ...
```

## Examples

### Example 1

**Input**
- 対象プロダクト/機能: サインアップ
- 主要ユーザー: 初回利用者
- 主要タスク: アカウント作成
- 現状の課題/痛み: フォーム離脱が多い
- 制約: 既存の認証基盤は変更不可
- 既存データ: 離脱率45%

**Output**
- 課題整理: 入力項目が多く、完了までの心理的負荷が高い
- 心理学原則と原因仮説: ヒックの法則 → 選択肢と入力項目の多さが意思決定時間を増加
- 改善案: 必須項目の削減、段階的入力、エラー表示の即時化
- 設計レビュー観点: 妥当性=入力分割で認知負荷を低減、リスク=登録完了率の測定期間不足、代替案=ソーシャルログイン導線の強調
- 検証計画: 完了率/所要時間のA/Bテスト
- 未決事項: 必須項目削減の業務影響

## References

- https://www.shokasonjuku.com/ux-psychology
