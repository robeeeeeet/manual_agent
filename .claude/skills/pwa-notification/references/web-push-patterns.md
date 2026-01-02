# Web Push パターン

> **Supabase Client命名規則**
> - Server用: `createServerSupabaseClient()` from `@/lib/supabase-server`
> - Admin用: `createAdminSupabaseClient()` from `@/lib/supabase-admin`（SUPABASE_SERVICE_ROLE_KEY必要）

## 購読管理

### DB保存

```typescript
// app/api/push/subscribe/route.ts
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subscription = await request.json()

  // 既存の購読を確認
  const { data: existing } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', subscription.endpoint)
    .single()

  if (existing) {
    return Response.json({ status: 'already_subscribed' })
  }

  // 新規保存
  await supabase.from('push_subscriptions').insert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth
  })

  return Response.json({ status: 'subscribed' })
}
```

### 購読解除

```typescript
// app/api/push/unsubscribe/route.ts
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient()
  const { endpoint } = await request.json()

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)

  return Response.json({ status: 'unsubscribed' })
}
```

## 通知送信

### 基本送信

```typescript
import webPush from 'web-push'

webPush.setVapidDetails(
  'mailto:your@email.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string
}

export async function sendPushNotification(
  subscription: {
    endpoint: string
    p256dh: string
    auth: string
  },
  payload: PushPayload
) {
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      JSON.stringify(payload)
    )
    return { success: true }
  } catch (error: any) {
    if (error.statusCode === 410) {
      // 購読が無効（ブラウザで解除された）
      return { success: false, expired: true }
    }
    throw error
  }
}
```

### 一括送信

```typescript
export async function sendBulkNotifications(
  userIds: string[],
  payload: PushPayload
) {
  const supabase = createAdminSupabaseClient()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  const results = await Promise.allSettled(
    (subscriptions ?? []).map(sub => sendPushNotification(sub, payload))
  )

  // 期限切れの購読を削除
  const expiredEndpoints = results
    .map((r, i) => r.status === 'fulfilled' && r.value.expired ? subscriptions![i].endpoint : null)
    .filter(Boolean)

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints)
  }

  return results
}
```

## スケジューラー

### Cron Job（Vercel）

```typescript
// app/api/cron/notifications/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Vercel Cronからの呼び出しを確認
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()

  // 今日が期限のスケジュールを取得
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: schedules } = await supabase
    .from('maintenance_schedules')
    .select(`
      *,
      appliances!inner(id, name, user_id)
    `)
    .gte('next_due_at', today.toISOString())
    .lt('next_due_at', tomorrow.toISOString())

  // ユーザーごとに通知をグループ化
  const byUser = new Map<string, typeof schedules>()
  for (const s of schedules ?? []) {
    const userId = s.appliances.user_id
    if (!byUser.has(userId)) byUser.set(userId, [])
    byUser.get(userId)!.push(s)
  }

  // 各ユーザーに通知送信
  for (const [userId, userSchedules] of byUser) {
    const count = userSchedules.length
    await sendBulkNotifications([userId], {
      title: 'メンテナンスリマインド',
      body: `本日${count}件のメンテナンス予定があります`,
      url: '/appliances'
    })
  }

  return Response.json({ notified: byUser.size })
}
```

### vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 9 * * *"
    }
  ]
}
```

## 通知UI

```tsx
'use client'

import { useState, useEffect } from 'react'
import { subscribeToPush } from '@/lib/push'

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const handleEnable = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      const subscription = await subscribeToPush()
      setSubscribed(!!subscription)
    }
  }

  if (permission === 'denied') {
    return <p className="text-red-600">通知がブロックされています</p>
  }

  if (subscribed) {
    return <p className="text-green-600">通知が有効です</p>
  }

  return (
    <button
      onClick={handleEnable}
      className="bg-blue-600 text-white px-4 py-2 rounded"
    >
      通知を有効にする
    </button>
  )
}
```
