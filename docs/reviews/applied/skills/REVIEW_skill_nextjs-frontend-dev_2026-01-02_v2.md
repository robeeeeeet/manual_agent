# Skill再レビュー: `nextjs-frontend-dev`（v2）

対象: `.claude/skills/nextjs-frontend-dev/`

## 改善が確認できた点

- **前提条件 / DoD / セキュリティ必須チェック** が `SKILL.md` に追加され、Skillsとしての再現性が上がっている。
- **Supabaseユーティリティ命名規則**（`createServerSupabaseClient` / `createBrowserSupabaseClient`）が明文化され、方針が明確になった。
- **BFFエラーフォーマット**（`{error, code, details?}`）と、転送の注意事項が追加されている。

## 残っている課題（優先度順）

1. **（高）BFF例が新方針に追従していない**
   - `SKILL.md` の `app/api/analyze/route.ts` 例が、認証確認・ヘッダ付与（`X-Backend-Key` 等）を行わない旧例のままに見える。
   - `hybrid-architecture` の方針（BFFで認証→FastAPIへ固定キー付与）と整合させる必要がある。
2. **（中）lib構成の記述が命名規則と不整合**
   - `lib/supabase.ts` 記載が残っており、命名規則で定義した `lib/supabase-browser.ts` / `lib/supabase-server.ts` と噛み合っていない。
3. **（中）Stream転送の注意書きが実行環境依存**
   - `duplex: 'half'` はランタイム（Node/Edge）で前提が変わるため、対象環境を明記すると安全。

## 追加で良くなる提案

- **（中）DoDの“検証手順”を追記**
  - 例: 未ログイン→リダイレクト確認、BFF経由アップロード成功、エラー時UI表示確認、などを1〜3項目で。


