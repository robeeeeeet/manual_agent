# Skillレビュー: `nextjs-frontend-dev`

対象: `.claude/skills/nextjs-frontend-dev/`

## 良い点

- **Server/Clientの判断基準が明快**: `use client` の使い所が表で整理されている。
- **UI実装の即効性**: Tailwindのパターンが豊富で、ページ/フォーム/カードなどを素早く組める。
- **BFF導線あり**: Next.js API Routes（BFF）からバックエンドへ転送する例があり、構成理解に役立つ。

## 懸念点

- **命名揺れが起きやすい**: Supabaseサーバークライアントが `createServerClient` / `createServerSupabaseClient` など参照間で揺れており、コピペで繋がらない可能性がある。
- **エラー標準化が未固定**: BFFのエラーレスポンス形式（`{error, code}`等）をプロジェクト全体で統一する指針が薄い。
- **BFF転送の落とし穴**: JSON / FormData / stream で取り扱いが異なるため、汎用例だけだと詰まりやすい。

## 改善提案（優先度順）

1. **（高）Supabaseユーティリティの命名を固定**
   - 推奨関数名を `SKILL.md` に明記し、`references/` 側も同名に合わせる。
2. **（中）BFFのレスポンス/エラー形式を統一**
   - `code`, `message`, `details` のような標準を決め、全Route例で同一にする。
3. **（中）DoD（完了条件）を追加**
   - 例: 認証付きページで未ログイン時にリダイレクト、BFF経由で画像アップロードが成功、など。
