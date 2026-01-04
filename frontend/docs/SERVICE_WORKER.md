# Service Worker & Push通知実装ガイド

PWA Push通知を受信・表示するためのService Worker実装とユーティリティ関数のドキュメント。

## ファイル構成

```
frontend/
├── public/
│   ├── custom-sw.js         # カスタムService Worker（Push通知処理）
│   ├── manifest.json        # PWAマニフェスト
│   └── icon.svg            # アプリアイコン
├── src/lib/
│   ├── serviceWorker.ts    # Service Worker登録・購読ユーティリティ
│   └── serviceWorker.example.ts # 使用例
└── next.config.ts          # next-pwa設定
```

## Service Worker機能

### 1. Push通知の受信 (`push` イベント)

通知サーバーからPush通知を受信し、ブラウザ通知を表示します。

**受信する通知ペイロード形式:**
```json
{
  "title": "メンテナンスリマインド",
  "body": "エアコンのフィルター清掃の時期です",
  "icon": "/icon-192.png",
  "badge": "/badge-72.png",
  "data": {
    "url": "/appliances/123",
    "type": "maintenance_reminder"
  }
}
```

### 2. 通知クリック処理 (`notificationclick` イベント)

通知をクリックした際の動作:
- `data.url` が指定されている場合: その画面に遷移
- 指定がない場合: アプリのホーム画面を開く
- 既存のウィンドウがある場合: フォーカスして遷移
- ない場合: 新しいウィンドウを開く

## ユーティリティ関数

### 通知購読

```typescript
import { subscribeToPush } from '@/lib/serviceWorker';

// Push通知を購読
const subscription = await subscribeToPush(vapidPublicKey);

if (subscription) {
  // 購読情報をバックエンドに送信
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
    }),
  });
}
```

### 購読解除

```typescript
import { unsubscribeFromPush } from '@/lib/serviceWorker';

// 購読を解除
const success = await unsubscribeFromPush();

if (success) {
  // バックエンドから購読情報を削除
  await fetch('/api/notifications/unsubscribe', {
    method: 'DELETE',
  });
}
```

### 購読状態の確認

```typescript
import { getSubscription, getNotificationPermission } from '@/lib/serviceWorker';

// 通知権限の確認
const permission = getNotificationPermission();
// 'granted' | 'denied' | 'default' | null

// 購読状態の確認
const subscription = await getSubscription();
const isSubscribed = !!subscription;
```

### テスト通知

```typescript
import { showTestNotification } from '@/lib/serviceWorker';

// Service Workerの動作確認用のテスト通知を表示
await showTestNotification();
```

## React Hookでの使用例

```typescript
import { useState, useEffect } from 'react';
import { getSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/serviceWorker';

export function useNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    const subscription = await getSubscription();
    setIsSubscribed(!!subscription);
    setLoading(false);
  };

  const subscribe = async () => {
    setLoading(true);
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    const subscription = await subscribeToPush(vapidPublicKey);

    if (subscription) {
      // DBに保存
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setIsSubscribed(true);
    }
    setLoading(false);
  };

  const unsubscribe = async () => {
    setLoading(true);
    const success = await unsubscribeFromPush();

    if (success) {
      await fetch('/api/notifications/unsubscribe', { method: 'DELETE' });
      setIsSubscribed(false);
    }
    setLoading(false);
  };

  return { isSubscribed, loading, subscribe, unsubscribe };
}
```

## 設定とセットアップ

### 1. next-pwa設定 (`next.config.ts`)

```typescript
import withPWA from "next-pwa";

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  sw: "custom-sw.js",  // カスタムService Worker使用
  buildExcludes: [/middleware-manifest\.json$/],
})(nextConfig);
```

### 2. 環境変数

```bash
# frontend/.env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<VAPID公開鍵>
```

VAPID鍵の生成方法は別ドキュメント（`VAPID_SETUP.md`）を参照してください。

### 3. アイコン準備

以下のアイコンファイルを `frontend/public/` に配置:
- `icon-192.png` (192x192px)
- `icon-512.png` (512x512px)
- `badge-72.png` (72x72px) - 通知バッジ用

現在は `icon.svg` がプレースホルダーとして配置されています。

## next-pwaとの統合

next-pwaは以下の処理を自動的に実行します:
- Service Workerの自動登録
- manifest.jsonの生成/最適化
- キャッシュ戦略の設定（Workbox）

カスタムService Worker（`custom-sw.js`）は、next-pwaが生成するWorkboxのService Workerと**並行して**動作します:
- Workbox: キャッシュ管理、オフライン対応
- Custom SW: Push通知の受信・表示

## セキュリティ注意事項

1. **VAPID秘密鍵は絶対にクライアントに露出させない**
   - 公開鍵のみクライアントで使用
   - 秘密鍵はバックエンドでのみ使用

2. **通知送信はサーバーサイドで実行**
   - クライアントから直接Push通知を送信しない
   - 必ずバックエンドAPIを経由

3. **購読情報の保護**
   - 購読エンドポイントには認証を必須とする
   - ユーザーごとに購読情報を分離

## プラットフォーム対応

| プラットフォーム | 対応状況 | 備考 |
|----------------|---------|------|
| Chrome/Edge | ✅ 完全対応 | |
| Firefox | ✅ 完全対応 | |
| Safari (macOS) | ✅ 対応 | macOS Ventura以降 |
| iOS Safari | ⚠️ 制限あり | iOS 16.4+、ホーム画面追加が必要 |

## デバッグとトラブルシューティング

### Service Workerの動作確認

1. Chrome DevTools → Application → Service Workers
2. 登録されているService Workerを確認
3. Console でログを確認

### テスト通知の送信

```typescript
import { showTestNotification } from '@/lib/serviceWorker';

// デバッグモードでテスト通知を表示
await showTestNotification();
```

### よくある問題

**Service Workerが登録されない**
- HTTPSが必要（localhost除く）
- ブラウザの互換性を確認
- DevToolsのConsoleでエラーを確認

**通知が表示されない**
- 通知権限が許可されているか確認
- Service Workerが正常に動作しているか確認
- Push通知のペイロードが正しいか確認

**購読が失敗する**
- VAPID公開鍵が正しいか確認
- Service Workerが登録済みか確認
- ブラウザが対応しているか確認

## 次のステップ

1. バックエンドでVAPID鍵を生成・設定
2. Push通知購読APIを実装（`/api/notifications/subscribe`）
3. 通知送信ロジックを実装（Cronジョブ等）
4. UIコンポーネントに通知設定機能を追加

詳細な実装例は `serviceWorker.example.ts` を参照してください。
