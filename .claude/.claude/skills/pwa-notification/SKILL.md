---
name: pwa-notification
description: PWA Push通知とService Worker実装。"プッシュ通知", "Service Worker", "PWA設定", "Web Push API", "通知スケジュール", "VAPID", "next-pwa", "バックグラウンド通知"などで使用。メンテナンスリマインド通知の実装パターンを参照。
---

# PWA Push通知

PWA対応とWeb Push通知の実装ガイド。

## 前提条件

- [ ] Next.js 14+（App Router）
- [ ] HTTPS環境（本番）またはlocalhost（開発）
- [ ] 環境変数: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- [ ] 依存パッケージ: `next-pwa`, `web-push`

## 完了条件（DoD）

- [ ] 購読がDBに保存される
- [ ] Cronで当日分のリマインドが送信できる
- [ ] 410エラー時に購読が削除される
- [ ] 通知クリックで該当ページに遷移する

## セキュリティ必須チェック

- [ ] **VAPID秘密鍵は絶対にクライアントに出さない**
- [ ] 送信処理は**必ずサーバーサイドで実行**
- [ ] Cronエンドポイントは認証で保護（シークレットキー）

## Push通知の前提条件チェックリスト

実装前に以下を確認：

| 項目 | 要件 | 備考 |
|------|------|------|
| HTTPS | 必須 | localhostは例外 |
| ブラウザ | Chrome, Firefox, Edge | Safari/iOS は制限あり |
| iOS Safari | iOS 16.4+ のみ | ホーム画面追加が必要 |
| 許可状態 | `Notification.permission` | `denied`時の再許可は困難 |

### 許可denied時のUI導線

```tsx
// 許可がdeniedの場合、ブラウザ設定への誘導が必要
function NotificationDeniedBanner() {
  return (
    <div className="bg-yellow-50 p-4 rounded">
      <p>通知がブロックされています。</p>
      <p className="text-sm text-gray-600">
        ブラウザの設定から通知を許可してください。
      </p>
    </div>
  )
}
```

## next-pwa セットアップ

### インストール

```bash
npm install next-pwa
```

### 設定

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})

module.exports = withPWA({
  // その他のNext.js設定
})
```

### App Router注意事項

> ⚠️ App Routerでは一部の `next.config.js` 設定が異なる動作をします

| 設定 | Pages Router | App Router |
|------|-------------|------------|
| `api.bodyParser` | 有効 | **Route Handlerには効かない** |
| Service Worker登録 | 自動 | 手動確認推奨 |

```typescript
// app/layout.tsx でService Worker登録を確認
'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW registration failed:', err))
    }
  }, [])
  return null
}
```

### マニフェスト

```json
// public/manifest.json
{
  "name": "説明書管理アプリ",
  "short_name": "説明書管理",
  "description": "家電メンテナンスをリマインド",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Web Push API

### VAPID鍵生成

```bash
npx web-push generate-vapid-keys
```

```bash
# .env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BN...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:your@email.com
```

### 購読登録（クライアント）

```typescript
'use client'

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push通知非対応')
    return null
  }

  const registration = await navigator.serviceWorker.ready

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    )
  })

  // サーバーに保存
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  })

  return subscription
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}
```

### 通知送信（サーバー）

```typescript
// app/api/push/send/route.ts
import webPush from 'web-push'

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: Request) {
  const { subscription, title, body, url } = await request.json()

  await webPush.sendNotification(
    subscription,
    JSON.stringify({ title, body, url })
  )

  return Response.json({ success: true })
}
```

### Service Worker

```javascript
// public/sw.js
self.addEventListener('push', event => {
  const data = event.data.json()

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { url: data.url }
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  )
})
```

## 詳細リファレンス

- [Web Pushパターン](references/web-push-patterns.md) - 通知スケジューリング
- [Service Workerガイド](references/service-worker-guide.md) - オフライン対応

## 通知スケジューリング

```typescript
// lib/notifications.ts
export async function scheduleMaintenanceNotifications() {
  const supabase = createClient()

  // 今日が期限のメンテナンスを取得
  const today = new Date().toISOString().split('T')[0]

  const { data: schedules } = await supabase
    .from('maintenance_schedules')
    .select('*, appliances(*), users!inner(push_subscriptions(*))')
    .eq('next_due_at::date', today)

  for (const schedule of schedules ?? []) {
    const subscriptions = schedule.users.push_subscriptions

    for (const sub of subscriptions) {
      await sendPushNotification(sub, {
        title: `${schedule.appliances.name}のメンテナンス`,
        body: schedule.task_name,
        url: `/appliances/${schedule.appliances.id}`
      })
    }
  }
}
```
