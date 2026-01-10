---
name: hybrid-architecture
description: Next.js + FastAPIハイブリッドアーキテクチャ設計・デバッグ。"API連携", "BFF層", "CORS設定", "フロントエンド-バックエンド通信", "認証フロー連携", "API設計", "エラー追跡"などで使用。ハイブリッド構成でのトラブルシューティングとベストプラクティスを参照。
---

# ハイブリッドアーキテクチャ

Next.js（フロントエンド/BFF）+ FastAPI（AIバックエンド）の統合ガイド。

## 前提条件

- [ ] Next.js 14+（App Router）
- [ ] FastAPI バックエンド稼働中
- [ ] 環境変数: `BACKEND_URL`, `BACKEND_API_KEY`
- [ ] 依存Skill: `nextjs-frontend-dev`, `fastapi-backend-dev`

## 完了条件（DoD）

- [ ] 未認証リクエストでBFFが401を返す
- [ ] 認証済みでFastAPI呼び出しが成功する
- [ ] エラーレスポンス形式が統一されている（`{error, code, details?}`）
- [ ] FastAPIへの直接アクセスがブロックされている（本番環境）

## セキュリティ必須チェック

- [ ] `BACKEND_API_KEY` は `NEXT_PUBLIC_` 接頭辞を**付けない**（サーバー専用）
- [ ] BFF→FastAPI間の通信はHTTPS（本番環境）
- [ ] FastAPI側でもヘッダー検証を実装

## 通信パスの原則

**ブラウザ→Next.js(BFF)のみ。FastAPI直叩きは原則禁止。**

```
[ブラウザ] → [Next.js BFF] → [FastAPI]
     ↑           ↓
     └─ Supabase Auth で認証確認
```

- **開発時**: `http://localhost:3000` → `http://localhost:8000`
- **本番時**: BFF経由のみ。FastAPIは内部ネットワークに配置

## アーキテクチャ概要

```
┌─────────────────────┐
│   ブラウザ / PWA     │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Next.js 14+        │
│  ├─ App Router      │
│  ├─ API Routes(BFF) │◄── 認証確認・プロキシ
│  └─ Server Actions  │
└──────────┬──────────┘
           │ REST API
┌──────────▼──────────┐
│  FastAPI            │
│  ├─ AI Services     │
│  ├─ LangChain       │
│  └─ LangGraph       │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Supabase           │
│  ├─ PostgreSQL      │
│  ├─ Auth            │
│  └─ Storage         │
└─────────────────────┘
```

## BFF層（Backend for Frontend）

### 役割

1. **認証確認**: リクエストにユーザー認証情報を付与
2. **プロキシ**: FastAPIへのリクエスト転送
3. **レスポンス整形**: フロントエンド用にデータ変換
4. **エラーハンドリング**: 統一的なエラーレスポンス

### 実装パターン

**MVP**: 固定キー認証（将来JWT移行予定）

```typescript
// app/api/analyze/route.ts
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// 統一エラーレスポンス型
type ErrorResponse = { error: string; code: string; details?: unknown }

export async function POST(request: NextRequest) {
  // 1. 認証確認
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  // 2. FastAPIに転送（固定キー認証）
  const formData = await request.formData()

  const backendResponse = await fetch(`${process.env.BACKEND_URL}/analyze`, {
    method: 'POST',
    headers: {
      'X-Backend-Key': process.env.BACKEND_API_KEY!,  // MVP: 固定キー
      'X-User-ID': user.id,                            // ユーザー情報転送
    },
    body: formData,
  })

  // 3. エラーハンドリング（統一フォーマット）
  if (!backendResponse.ok) {
    const error = await backendResponse.json()
    return NextResponse.json<ErrorResponse>(
      {
        error: error.message || 'Backend error',
        code: error.code || 'BACKEND_ERROR',
        details: error.details
      },
      { status: backendResponse.status }
    )
  }

  // 4. レスポンス返却
  const result = await backendResponse.json()
  return NextResponse.json(result)
}
```

## CORS設定

**BFF経由が基本のため、FastAPI側CORSは開発時のみ必要。**

本番環境ではFastAPIを内部ネットワークに配置し、CORSは不要。

### FastAPI（開発環境のみ）

```python
# app/main.py
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# 開発環境のみCORS有効化
if settings.ENVIRONMENT == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

### 環境変数

```bash
# .env.local (Next.js)
BACKEND_URL=http://localhost:8000
BACKEND_API_KEY=your-secret-key

# .env (FastAPI)
FRONTEND_URL=http://localhost:3000
BACKEND_API_KEY=your-secret-key
```

## 認証フロー

```
1. ユーザーがNext.jsでログイン
   └─> Supabase Authでセッション取得

2. クライアントがAPI呼び出し
   └─> Next.js API Route (BFF)

3. BFFがセッション検証
   └─> Supabase Auth確認

4. BFFがFastAPIに転送
   └─> ユーザーID付きリクエスト

5. FastAPIが処理
   └─> 必要に応じてSupabase直接アクセス
```

## API設計

| エンドポイント | Next.js BFF | FastAPI | 説明 |
|--------------|-------------|---------|------|
| `/api/analyze` | `/api/analyze` | `/analyze` | 画像解析 |
| `/api/manuals` | `/api/manuals` | `/manuals` | マニュアル処理 |
| `/api/maintenance` | - | - | Supabase直接 |

## 詳細リファレンス

- [BFFパターン](references/bff-patterns.md) - 認証、プロキシ、エラー処理
- [トラブルシューティング](references/troubleshooting.md) - よくある問題と解決策

## 開発環境

```bash
# 同時起動（推奨）
npm install -g concurrently

# package.json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && uv run uvicorn app.main:app --reload"
  }
}
```
