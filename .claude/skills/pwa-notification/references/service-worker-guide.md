# Service Worker ガイド

## 基本構造

```javascript
// public/sw.js

const CACHE_NAME = 'manual-app-v1'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

// インストール時にキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})
```

## フェッチ戦略

### Network First（API向け）

```javascript
self.addEventListener('fetch', event => {
  const { request } = event

  // API呼び出しはネットワーク優先
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(request))
    )
    return
  }

  // その他はキャッシュ優先
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        // 成功したらキャッシュ
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone)
          })
        }
        return response
      })
    })
  )
})
```

### Stale-While-Revalidate

```javascript
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cached => {
        const fetching = fetch(event.request).then(response => {
          cache.put(event.request, response.clone())
          return response
        })
        return cached || fetching
      })
    })
  )
})
```

## Push通知

### 受信処理

```javascript
self.addEventListener('push', event => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: '開く' },
      { action: 'close', title: '閉じる' }
    ],
    tag: data.tag || 'default',  // 同じtagの通知は上書き
    renotify: true
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})
```

### クリック処理

```javascript
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'close') return

  const url = event.notification.data.url

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // 既存のウィンドウがあればフォーカス
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        // なければ新しいウィンドウを開く
        return clients.openWindow(url)
      })
  )
})

// 通知を閉じた時
self.addEventListener('notificationclose', event => {
  // アナリティクス等
  console.log('Notification closed', event.notification.tag)
})
```

## バックグラウンド同期

```javascript
// 登録
navigator.serviceWorker.ready.then(registration => {
  return registration.sync.register('sync-maintenance-logs')
})

// Service Worker側で処理
self.addEventListener('sync', event => {
  if (event.tag === 'sync-maintenance-logs') {
    event.waitUntil(syncMaintenanceLogs())
  }
})

async function syncMaintenanceLogs() {
  const db = await openIndexedDB()
  const pendingLogs = await db.getAll('pending-logs')

  for (const log of pendingLogs) {
    try {
      await fetch('/api/maintenance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log)
      })
      await db.delete('pending-logs', log.id)
    } catch (error) {
      // 次回同期時にリトライ
    }
  }
}
```

## オフライン対応

### オフラインページ

```javascript
const OFFLINE_PAGE = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.add(OFFLINE_PAGE)
    })
  )
})

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_PAGE)
      })
    )
  }
})
```

### IndexedDB連携

```javascript
// オフラインデータ保存
async function saveOffline(data) {
  const db = await openIndexedDB()
  await db.add('offline-data', data)
}

// オンライン復帰時に同期
self.addEventListener('online', () => {
  syncOfflineData()
})
```

## next-pwa カスタマイズ

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.example\.com\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 // 1時間
        }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30 // 30日
        }
      }
    }
  ]
})
```
