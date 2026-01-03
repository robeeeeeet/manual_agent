# プロジェクト概要

## 目的
説明書管理 & メンテナンスリマインドアプリ

家電や住宅設備の説明書を管理し、メンテナンス項目をリマインドするWebアプリ。
AIを活用して商品認識・説明書取得・メンテナンス項目抽出を自動化する。

## アーキテクチャ
**ハイブリッド構成**: Next.js（フロントエンド）+ Python（AIバックエンド）

```
クライアント（ブラウザ/PWA）
        ↓
Next.js 16+ (TypeScript) - UI/BFF層
        ↓ REST API
FastAPI (Python) - AIバックエンド
   ├── LangChain (RAG)
   ├── LangGraph (エージェント)
   └── Gemini API
        ↓
Supabase (PostgreSQL/pgvector/Auth/Storage)
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16+, TypeScript, Tailwind CSS 4, React 19, PWA |
| BFF層 | Next.js API Routes |
| AIバックエンド | FastAPI, LangChain, LangGraph, Gemini API (google-genai) |
| データベース | Supabase PostgreSQL, pgvector |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage |
| パッケージ管理 | uv (Python), npm (Node.js) |
| デプロイ（フロント） | Vercel |
| デプロイ（バック） | Google Cloud Run |
| CI/CD | GitHub Actions |

## ディレクトリ構造

```
manual_agent/
├── CLAUDE.md              # AI向けガイド
├── CHANGELOG.md           # 変更履歴
├── docs/                  # ドキュメント
├── frontend/              # Next.js アプリケーション
│   ├── src/app/           # App Router
│   ├── src/components/    # UIコンポーネント
│   └── src/lib/           # ユーティリティ
├── backend/               # FastAPI アプリケーション
│   ├── app/
│   │   ├── api/routes/    # APIルート
│   │   ├── schemas/       # Pydanticスキーマ
│   │   ├── services/      # ビジネスロジック
│   │   └── main.py
│   └── supabase/          # DBスキーマ・マイグレーション
├── tests/phase0/          # Phase 0 検証スクリプト
└── .env                   # 環境変数（git管理外）
```

## 重要な設計判断

1. **AI優先アプローチ**: 手動入力よりAI自動認識を優先
2. **PDF保存方式**: リンク保存ではなくPDFダウンロード保存
3. **カテゴリ**: 事前定義リスト + 自由入力の両対応
4. **認証・DB・ストレージ**: Supabaseで一元管理
