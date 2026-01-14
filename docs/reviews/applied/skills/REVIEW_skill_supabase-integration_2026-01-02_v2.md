# Skill再レビュー: `supabase-integration`（v2）

対象: `.claude/skills/supabase-integration/`

## 改善が確認できた点

- **SQL実行順序**が明記され、依存関係エラーを避けやすくなった。
- **RLS対象テーブル一覧**が追加され、セキュリティ要件が具体化された。
- **共通RLS有効化**と `maintenance_schedules` の親テーブル経由ポリシー例が入り、実装の漏れが減った。
- **Service Role Keyの取り扱い**が強調されている。

## 残っている課題（優先度順）

1. **（中）キー名の揺れをなくす**
   - `SUPABASE_KEY` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` の役割をSkills横断で固定すると事故が減る。
2. **（中）RLS一覧に対する雛形の網羅**
   - 一覧にある `users` / `documents` などの最小ポリシー例が `SKILL.md` 内に揃うと「やり切り」になる。

## 追加で良くなる提案

- **（中）DoDの検証手順を1〜2個追記**
  - 例: 未認証でselect不可、認証後に自分の行のみ取得できる、などをSQL/クエリ例で短く。
