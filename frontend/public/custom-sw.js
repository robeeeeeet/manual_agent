// カスタムService Worker
// Push通知の受信・表示とクリック処理を担当

// Push通知を受信したときの処理
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received:', event);

  // デフォルトの通知設定
  const defaultOptions = {
    title: 'メンテナンスリマインド',
    body: '新しい通知があります',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'maintenance-reminder',
    requireInteraction: false,
    data: {
      url: '/',
      type: 'maintenance_reminder',
      dateOfArrival: Date.now(),
    },
  };

  let notificationData = defaultOptions;

  // Push通知のペイロードを解析
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[Service Worker] Push payload:', payload);

      notificationData = {
        ...defaultOptions,
        title: payload.title || defaultOptions.title,
        body: payload.body || defaultOptions.body,
        icon: payload.icon || defaultOptions.icon,
        badge: payload.badge || defaultOptions.badge,
        data: {
          ...defaultOptions.data,
          ...payload.data,
        },
      };
    } catch (error) {
      console.error('[Service Worker] Error parsing push payload:', error);
      // エラーの場合はデフォルトの通知を使用
    }
  }

  // 通知を表示
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      vibrate: notificationData.vibrate,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
    })
  );
});

// 通知がクリックされたときの処理
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  // 通知を閉じる
  event.notification.close();

  // 遷移先URLを取得（デフォルトはホーム画面）
  const urlToOpen = event.notification.data?.url || '/';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  console.log('[Service Worker] Opening URL:', fullUrl);

  // アプリの画面を開く処理
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // 既存のウィンドウがあるか確認
        for (const client of clientList) {
          // 同じオリジンのウィンドウが既に開いている場合
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            // そのウィンドウにフォーカスして遷移
            return client.focus().then((focusedClient) => {
              if ('navigate' in focusedClient) {
                return focusedClient.navigate(fullUrl);
              }
              return focusedClient;
            });
          }
        }

        // 既存のウィンドウがない場合は新しいウィンドウを開く
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
      .catch((error) => {
        console.error('[Service Worker] Error handling notification click:', error);
      })
  );
});

// Service Workerのインストール
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing custom service worker');
  // 新しいService Workerを即座にアクティブ化
  self.skipWaiting();
});

// Service Workerのアクティベーション
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating custom service worker');
  // 既存のクライアントを即座に制御下に置く
  event.waitUntil(clients.claim());
});

// エラーハンドリング
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});
