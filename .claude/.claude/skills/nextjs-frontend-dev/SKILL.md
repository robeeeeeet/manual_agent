---
name: nextjs-frontend-dev
description: Next.js 14+ App Router + Tailwind CSSフロントエンド開発。"コンポーネント作成", "ページ追加", "Tailwindスタイリング", "フォーム実装", "Server Component", "Client Component", "レイアウト作成", "React hooks"などで使用。TypeScriptベースのモダンUI開発パターンを参照。
---

# Next.js フロントエンド開発

Next.js 14+ App Router + Tailwind CSS + TypeScriptでのUI開発ガイド。

## 前提条件

- [ ] Node.js 18+
- [ ] npm または pnpm
- [ ] 環境変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 依存Skill: `supabase-integration`

## 完了条件（DoD）

- [ ] 認証付きページで未ログイン時にリダイレクトする
- [ ] BFF経由で画像アップロードが成功する
- [ ] エラー表示がユーザーフレンドリー
- [ ] レスポンシブデザインが動作する（モバイル/デスクトップ）

## セキュリティ必須チェック

- [ ] `SUPABASE_SERVICE_ROLE_KEY` は `NEXT_PUBLIC_` 接頭辞を**付けない**
- [ ] ユーザー入力は適切にサニタイズ（XSS対策）
- [ ] 認証状態の確認はServer Componentで実施

## Supabaseユーティリティ命名規則

**プロジェクト全体で以下の命名を統一：**

| 用途 | 関数名 | ファイル |
|------|--------|----------|
| Server Component用 | `createServerSupabaseClient()` | `lib/supabase-server.ts` |
| Client Component用 | `createBrowserSupabaseClient()` | `lib/supabase-browser.ts` |
| API Route用 | `createServerSupabaseClient()` | `lib/supabase-server.ts` |

## プロジェクト構造

```
frontend/
├── app/
│   ├── layout.tsx          # ルートレイアウト
│   ├── page.tsx             # ホームページ
│   ├── (auth)/              # 認証グループ
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── appliances/          # 家電管理
│   │   ├── page.tsx         # 一覧
│   │   ├── [id]/page.tsx    # 詳細
│   │   └── new/page.tsx     # 登録
│   └── api/                 # API Routes (BFF)
├── components/
│   ├── ui/                  # 汎用UIコンポーネント
│   └── features/            # 機能別コンポーネント
└── lib/
    ├── supabase-server.ts   # Server Component / API Route用
    ├── supabase-browser.ts  # Client Component用
    └── utils.ts
```

## Server vs Client Components

### 判断基準

| 条件 | コンポーネント |
|------|---------------|
| データフェッチ | Server Component |
| SEO重要 | Server Component |
| useState/useEffect | Client Component (`'use client'`) |
| イベントハンドラ | Client Component |
| ブラウザAPI使用 | Client Component |

### Server Component

```tsx
// app/appliances/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function AppliancesPage() {
  const supabase = createServerSupabaseClient()
  const { data: appliances } = await supabase
    .from('appliances')
    .select('*')
    .order('next_due_at')

  return (
    <div className="container mx-auto p-4">
      {appliances?.map(a => <ApplianceCard key={a.id} appliance={a} />)}
    </div>
  )
}
```

### Client Component

```tsx
'use client'

import { useState } from 'react'

export function ImageUploader({ onUpload }: { onUpload: (file: File) => void }) {
  const [preview, setPreview] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPreview(URL.createObjectURL(file))
      onUpload(file)
    }
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-4">
      <input type="file" accept="image/*" onChange={handleChange} />
      {preview && <img src={preview} alt="Preview" className="mt-2 max-h-48" />}
    </div>
  )
}
```

## Tailwind パターン

### 基本レイアウト

```tsx
// レスポンシブコンテナ
<div className="container mx-auto px-4 sm:px-6 lg:px-8">

// フレックスセンタリング
<div className="flex items-center justify-center min-h-screen">

// グリッドレイアウト
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### カード

```tsx
<div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
  <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
  <p className="text-gray-600 mt-2">{description}</p>
</div>
```

### ボタン

```tsx
// プライマリ
<button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">

// セカンダリ
<button className="border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50">

// 危険
<button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
```

## API Routes (BFF)

```tsx
// app/api/analyze/route.ts
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // 1. 認証確認
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  // 2. FastAPIバックエンドに転送
  const formData = await request.formData()
  const backendResponse = await fetch(`${process.env.BACKEND_URL}/analyze`, {
    method: 'POST',
    headers: { 'X-Backend-Key': process.env.BACKEND_API_KEY! },
    body: formData,
  })

  const result = await backendResponse.json()
  return NextResponse.json(result)
}
```

## 詳細リファレンス

- [App Routerパターン](references/app-router-patterns.md) - ルーティング、レイアウト
- [Tailwindコンポーネント](references/tailwind-component-patterns.md) - UIパターン集
- [Supabase Auth連携](references/supabase-auth-client.md) - クライアント認証

## BFFエラーレスポンス形式

**プロジェクト全体で統一：**

```typescript
// types/api.ts
export type ApiErrorResponse = {
  error: string      // ユーザー向けメッセージ
  code: string       // エラーコード（例: "AUTH_REQUIRED", "VALIDATION_ERROR"）
  details?: unknown  // 開発者向け詳細情報
}

// 使用例
return NextResponse.json<ApiErrorResponse>(
  { error: '認証が必要です', code: 'AUTH_REQUIRED' },
  { status: 401 }
)
```

## BFF転送の注意事項

| データ種別 | 転送方法 | 注意点 |
|-----------|---------|--------|
| JSON | `request.json()` | そのまま `JSON.stringify()` |
| FormData | `request.formData()` | ヘッダー設定不要（自動設定） |
| Stream | `request.body` | `duplex: 'half'` 必要 |

```typescript
// FormData転送例
const formData = await request.formData()
const response = await fetch(`${BACKEND_URL}/upload`, {
  method: 'POST',
  headers: { 'X-Backend-Key': process.env.BACKEND_API_KEY! },
  body: formData,  // Content-Type自動設定
})
```

## 注意事項

- `'use client'` は必要な場合のみ使用
- 画像は `next/image` を使用
- 環境変数は `NEXT_PUBLIC_` プレフィックス（クライアント用）
