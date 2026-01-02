# Skill再レビュー: `project-testing`（v2）

対象: `.claude/skills/project-testing/`

## 改善が確認できた点

- **DoDが具体化**され、テストが「いつ何をもって完了か」が判断しやすい。
- **テスト戦略（最小指針）**が入り、PR/main/リリース前の棲み分けが明確。
- **pytestテンプレ2系統**（DBなし / DBあり）が追加され、導入の迷いが減っている。

## 残っている課題（優先度順）

1. **（低）DBありテンプレの前提がまだ曖昧**
   - Supabase admin操作をする場合の鍵（service role）や、テストデータのクリーンアップ方針を短く補足するとより安全。

## 追加で良くなる提案

- **（低）CIの最小コマンド例**
  - 例: `uv run pytest ...` / `npm run test:coverage` / `npx playwright test` の最小構成を1箇所にまとめる。


