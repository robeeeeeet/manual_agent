# Push通知クイックスタートガイド

Service Workerが正しく実装されたか確認し、Push通知を動作させるための手順。

## 前提条件

- HTTPS環境（本番）またはlocalhost（開発）
- モダンブラウザ（Chrome、Firefox、Safari等）
- Service Worker対応ブラウザ

## 1. 実装確認

### ファイルの存在確認

以下のファイルが正しく作成されているか確認:

```bash
# プロジェクトルートから
ls frontend/public/custom-sw.js
ls frontend/src/lib/serviceWorker.ts
ls frontend/src/lib/serviceWorker.example.ts
ls frontend/docs/SERVICE_WORKER.md
```

### next.config.tsの確認

`frontend/next.config.ts` に以下の設定があることを確認:

```typescript
export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  sw: "custom-sw.js",  // ← この行があること
})(nextConfig);
```

## 2. ビルドとService Worker生成

### 開発環境での確認

開発環境ではPWAが無効化されているため、本番ビルドで確認:

```bash
cd frontend

# ビルド（Service Workerが生成される）
npm run build

# 本番モードで起動
npm start
```

ブラウザで `http://localhost:3000` にアクセス。

### Service Workerの登録確認

Chrome DevToolsで確認:

1. DevTools → **Application** タブ
2. 左メニュー → **Service Workers**
3. `custom-sw.js` が登録されていることを確認
4. Status が "activated and is running" であることを確認

## 3. 通知権限のリクエスト

### ブラウザコンソールでテスト

DevTools → **Console** タブで以下を実行:

```javascript
// 通知権限をリクエスト
await Notification.requestPermission()
// "granted" が返ればOK
```

### UIから実装する場合

コンポーネント例:

```typescript
'use client';

import { requestNotificationPermission } from '@/lib/serviceWorker';

export default function NotificationButton() {
  const handleRequest = async () => {
    const permission = await requestNotificationPermission();
    console.log('Permission:', permission);
  };

  return <button onClick={handleRequest}>通知を許可</button>;
}
```

## 4. テスト通知の表示

### ブラウザコンソールでテスト

```javascript
// Service Worker登録を確認
const registration = await navigator.serviceWorker.ready;
console.log('Service Worker ready:', registration);

// テスト通知を表示
registration.showNotification('テスト通知', {
  body: 'Service Workerが正常に動作しています',
  icon: '/icon.svg',
  tag: 'test',
  data: { url: '/' }
});
```

### ユーティリティ関数でテスト

```javascript
// serviceWorker.tsのテスト関数を使用
import { showTestNotification } from '@/lib/serviceWorker';

await showTestNotification();
```

## 5. Push通知の購読

### VAPID鍵の準備

まずVAPID鍵ペアを生成（バックエンドで実行）:

```bash
cd backend
uv run python -c "from pywebpush import webpush; print(webpush.generate_vapid_keys_json())"
```

出力例:
```json
{
  "publicKey": "BG3...(省略)",
  "privateKey": "abc...(省略)"
}
```

### 環境変数の設定

```bash
# frontend/.env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<公開鍵をここに貼り付け>

# backend/.env（またはCloud Run Secret Manager）
VAPID_PRIVATE_KEY=<秘密鍵をここに貼り付け>
VAPID_PUBLIC_KEY=<公開鍵をここに貼り付け>
```

### ブラウザコンソールでテスト

```javascript
// VAPID公開鍵（上記で生成したもの）
const vapidPublicKey = 'BG3...';

// Base64をUint8Arrayに変換
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Push通知を購読
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
});

console.log('Subscription:', JSON.stringify(subscription));
```

### ユーティリティ関数で購読

```typescript
import { subscribeToPush } from '@/lib/serviceWorker';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const subscription = await subscribeToPush(vapidPublicKey);

if (subscription) {
  console.log('購読成功:', subscription.toJSON());

  // バックエンドに購読情報を保存
  await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() })
  });
}
```

## 6. Push通知の送信テスト

### Pythonでテスト送信（バックエンド）

```python
from pywebpush import webpush
import json

# 購読情報（上記で取得したもの）
subscription_info = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
        "p256dh": "...",
        "auth": "..."
    }
}

# 通知ペイロード
payload = json.dumps({
    "title": "テスト通知",
    "body": "これはテスト通知です",
    "icon": "/icon.svg",
    "data": {
        "url": "/",
        "type": "test"
    }
})

# VAPID情報
vapid_claims = {
    "sub": "mailto:your-email@example.com"
}

# Push通知を送信
response = webpush(
    subscription_info=subscription_info,
    data=payload,
    vapid_private_key="<VAPID秘密鍵>",
    vapid_claims=vapid_claims
)

print(f"Response: {response.status_code}")
```

## 7. 通知クリックの動作確認

1. 上記で送信したPush通知を受信
2. 通知をクリック
3. ブラウザが開き、`data.url` に指定したページに遷移することを確認

### DevToolsでログ確認

Console で以下のログが表示されることを確認:
- `[Service Worker] Push notification received`
- `[Service Worker] Notification clicked`
- `[Service Worker] Opening URL: /`

## トラブルシューティング

### Service Workerが登録されない

**原因**: 開発環境でPWAが無効化されている

**解決策**: 本番ビルドで確認
```bash
npm run build
npm start
```

### 通知が表示されない

**原因1**: 通知権限が許可されていない

**解決策**: ブラウザ設定で通知を許可

**原因2**: Service Workerがアクティブでない

**解決策**: DevTools → Application → Service Workers で確認

### Push通知が受信できない

**原因1**: VAPID鍵が間違っている

**解決策**: 公開鍵・秘密鍵のペアが正しいか確認

**原因2**: 購読情報が無効

**解決策**: 購読を解除して再度購読

```javascript
const subscription = await registration.pushManager.getSubscription();
await subscription.unsubscribe();
// 再度購読
```

### 通知クリックで画面遷移しない

**原因**: `data.url` が正しくない、またはService Workerのコードにエラーがある

**解決策**: DevToolsのConsoleでエラーログを確認

## 次のステップ

1. バックエンドAPIの実装
   - `/api/notifications/subscribe` - 購読情報をDBに保存
   - `/api/notifications/unsubscribe` - 購読情報を削除
   - `/api/notifications/send` - Push通知を送信

2. UIコンポーネントの実装
   - 通知設定ページ
   - 通知ON/OFFトグル
   - 購読状態の表示

3. Cronジョブの設定
   - メンテナンスリマインド通知の自動送信
   - 期限切れ購読の削除

詳細は `SERVICE_WORKER.md` を参照してください。
