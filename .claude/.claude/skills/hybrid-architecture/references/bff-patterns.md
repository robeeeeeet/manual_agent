# BFF パターン

## 基本構造

```typescript
// app/api/[...path]/route.ts - 汎用プロキシ
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL!

// 統一エラーレスポンス型
type ErrorResponse = { error: string; code: string; details?: unknown }

export async function handler(
  request: NextRequest,
  method: string
) {
  // 認証確認
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  // パス抽出
  const path = request.nextUrl.pathname.replace('/api', '')

  // バックエンドに転送（固定キー認証）
  const headers = new Headers()
  headers.set('X-Backend-Key', process.env.BACKEND_API_KEY!)  // MVP: 固定キー
  headers.set('X-User-ID', user.id)

  // Content-Typeを維持
  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers.set('Content-Type', contentType)
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers,
    body: method !== 'GET' ? await request.blob() : undefined,
  })

  // レスポンス転送
  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}

export const GET = (req: NextRequest) => handler(req, 'GET')
export const POST = (req: NextRequest) => handler(req, 'POST')
export const PUT = (req: NextRequest) => handler(req, 'PUT')
export const DELETE = (req: NextRequest) => handler(req, 'DELETE')
```

## ファイルアップロード

```typescript
// app/api/upload/route.ts
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  // FormDataをそのまま転送
  const formData = await request.formData()

  const response = await fetch(`${BACKEND_URL}/upload`, {
    method: 'POST',
    headers: {
      'X-Backend-Key': process.env.BACKEND_API_KEY!,
      'X-User-ID': user.id,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    return NextResponse.json<ErrorResponse>(
      { error: error.message || 'Upload failed', code: error.code || 'UPLOAD_ERROR' },
      { status: response.status }
    )
  }

  return NextResponse.json(await response.json())
}
```

## ストリーミングレスポンス

```typescript
// app/api/stream/route.ts
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ErrorResponse>(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  const body = await request.json()

  const response = await fetch(`${BACKEND_URL}/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Backend-Key': process.env.BACKEND_API_KEY!,
      'X-User-ID': user.id,
    },
    body: JSON.stringify(body),
  })

  // ストリーミングレスポンスを転送
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

## エラーハンドリング

```typescript
// lib/api-error.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message)
  }
}

export function handleAPIError(error: unknown): NextResponse {
  console.error('API Error:', error)

  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    )
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { error: 'Unknown error', code: 'UNKNOWN' },
    { status: 500 }
  )
}

// 使用例
export async function POST(request: NextRequest) {
  try {
    // 処理
  } catch (error) {
    return handleAPIError(error)
  }
}
```

## レート制限

```typescript
// lib/rate-limit.ts
import { LRUCache } from 'lru-cache'

const rateLimit = new LRUCache<string, number[]>({
  max: 500,
  ttl: 60 * 1000, // 1分
})

export function checkRateLimit(userId: string, limit: number): boolean {
  const now = Date.now()
  const timestamps = rateLimit.get(userId) || []

  // 古いタイムスタンプを削除
  const recent = timestamps.filter(t => now - t < 60 * 1000)

  if (recent.length >= limit) {
    return false
  }

  recent.push(now)
  rateLimit.set(userId, recent)
  return true
}

// 使用例
export async function POST(request: NextRequest) {
  const user = await getUser()

  if (!checkRateLimit(user.id, 60)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // 処理続行
}
```

## キャッシュ

```typescript
// app/api/cached/route.ts
import { unstable_cache } from 'next/cache'

const getCachedData = unstable_cache(
  async (key: string) => {
    const response = await fetch(`${BACKEND_URL}/data/${key}`)
    return response.json()
  },
  ['cached-data'],
  {
    revalidate: 60, // 60秒
    tags: ['data'],
  }
)

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key) {
    return NextResponse.json({ error: 'Key required' }, { status: 400 })
  }

  const data = await getCachedData(key)
  return NextResponse.json(data)
}

// キャッシュ無効化
import { revalidateTag } from 'next/cache'

export async function POST(request: NextRequest) {
  // データ更新後
  revalidateTag('data')
}
```
