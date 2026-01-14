# Skillレビュー: `manual-ai-processing`

対象: `.claude/skills/manual-ai-processing/`

## 良い点

- **プロダクト要件に最適化**: 画像認識→PDF処理→メンテ抽出→頻度正規化まで、必要な要素が揃っている。
- **スキーマが具体的**: `maintenance-extraction-schema.md` の出力スキーマとマッピングルールが明確で、実装のブレが出にくい。
- **失敗を見据えた実装例**: JSON抽出やレート制限（ResourceExhausted）の扱いが例示されている。

## 懸念点

- **Gemini SDKの呼び方が混在**: `google.generativeai` と `google.genai` の例が併存しており、依存関係/バージョンによってはそのまま動かない可能性がある。
- **不確実性の扱いが未固定**: 抽出できない場合の扱い（空欄、`frequency_days=None`、ページ参照不明、など）の標準ルールが `SKILL.md` に集約されていない。

## 改善提案（優先度順）

1. **（高）採用SDK・推奨バージョン・レスポンス取得方法を固定**
   - 例: 「本プロジェクトは `google.genai` を採用」などを `SKILL.md` 冒頭で明記。
2. **（高）抽出パイプラインを“必須3段階”として明文化**
   - schema validation → 正規化（frequency_days等）→ 保存、を固定手順にする。
3. **（中）DoD（完了条件）を追加**
   - 例: 代表PDF1件で抽出が通る、JSONパース失敗時もエラーが構造化される、等。
