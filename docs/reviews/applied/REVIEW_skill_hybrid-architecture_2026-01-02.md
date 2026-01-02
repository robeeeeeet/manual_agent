# Skillレビュー: `hybrid-architecture`

対象: `.claude/skills/hybrid-architecture/`

## 良い点

- **全体像が掴みやすい**: 構成図と役割分担（Next.js=BFF、FastAPI=AI、Supabase=基盤）が明快。
- **BFFの責務が具体的**: 認証確認・プロキシ・レスポンス整形・エラーハンドリングの整理が良い。
- **トラブルシュートが強い**: `references/troubleshooting.md` が実務の失敗パターンに直結している。

## 懸念点

- **CORSの説明が混乱しやすい**: 「BFF経由が基本」の場合、ブラウザ→FastAPI直叩きのCORSは原則不要になるため、前提の整理が欲しい。
- **FastAPI側の認証検証が不明確**: BFFが付与する `BACKEND_API_KEY` 等を、FastAPIがどう検証・どの権限を付与するかが固定されていない。

## 改善提案（優先度順）

1. **（高）通信パスの原則を明文化**
   - 例: 「ブラウザ→Next(BFF)のみ。FastAPI直叩きは原則禁止（例外時のみCORS）」。
2. **（高）BFF→FastAPIの認証方式を固定**
   - 固定キー/JWT/署名付きヘッダのいずれかに統一し、FastAPI側で必ず検証する前提を追記。
3. **（中）DoD（完了条件）を追加**
   - 例: 未認証でBFFが401、認証済みでFastAPI呼び出し成功、エラー形式が統一、等。


