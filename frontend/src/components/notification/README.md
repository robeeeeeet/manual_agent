# 通知許可UIコンポーネント

PWA Push通知のための通知許可UIコンポーネント群。

## ファイル構成

- `NotificationPermission.tsx`: 通知許可状態を表示し、有効化するUIコンポーネント
- `../../hooks/usePushNotification.ts`: Push通知の購読/解除処理を管理するカスタムフック

## 使用方法

### 基本的な使い方

```tsx
import NotificationPermission from "@/components/notification/NotificationPermission";

export default function SettingsPage() {
  return (
    <div>
      <h1>設定</h1>
      <NotificationPermission />
    </div>
  );
}
```

### ヘッダーへの統合（既に実装済み）

`Header.tsx`にベルアイコンが追加されており、クリックすると通知設定パネルが表示されます。

- **デスクトップ**: ベルアイコンをクリックするとドロップダウンパネルで表示
- **モバイル**: メニュー内に通知設定が表示

## 機能

### NotificationPermissionコンポーネント

通知の許可状態に応じて以下のUIを表示します：

1. **ブラウザが非対応**: グレーの情報ボックス
2. **通知が拒否**: 赤色の警告ボックス（ブラウザ設定から許可するよう案内）
3. **通知が許可済み**: 緑色の確認ボックス（購読解除ボタン付き）
4. **通知未設定**: 青色のアクションボックス（「通知を有効にする」ボタン）

### usePushNotificationフック

Push通知の購読/解除処理を管理するカスタムフックです。

#### 返り値

```typescript
{
  isSupported: boolean;              // ブラウザがPush通知をサポートしているか
  permission: NotificationPermission | null; // 通知の許可状態
  isSubscribed: boolean;             // Push通知に購読しているか
  loading: boolean;                  // 処理中フラグ
  error: string | null;              // エラーメッセージ
  requestPermission: () => Promise<void>; // 通知許可をリクエスト
  subscribe: () => Promise<void>;    // Push通知を購読
  unsubscribe: () => Promise<void>;  // Push通知の購読を解除
}
```

#### 使用例

```typescript
import { usePushNotification } from "@/hooks/usePushNotification";

function MyComponent() {
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    requestPermission,
    unsubscribe,
  } = usePushNotification();

  if (!isSupported) {
    return <div>このブラウザは通知をサポートしていません</div>;
  }

  return (
    <div>
      <p>通知状態: {permission}</p>
      <p>購読状態: {isSubscribed ? "購読中" : "未購読"}</p>
      {error && <p>エラー: {error}</p>}
      <button onClick={requestPermission} disabled={loading}>
        通知を有効にする
      </button>
      <button onClick={unsubscribe} disabled={loading}>
        購読解除
      </button>
    </div>
  );
}
```

## API連携

以下のAPIエンドポイントと連携します：

- `GET /api/push/vapid-public-key`: VAPID公開鍵を取得
- `POST /api/push/subscribe`: Push通知の購読を登録
- `DELETE /api/push/unsubscribe`: Push通知の購読を解除

## Service Worker

通知機能を動作させるには、Service Worker（`/sw.js`または`/custom-sw.js`）が必要です。

Service Workerは以下の処理を行います：

1. **Push通知の受信**: サーバーからPush通知を受信
2. **通知の表示**: 受信したペイロードを元に通知を表示
3. **通知のクリック処理**: 通知をクリックしたときの画面遷移

## デザイン

- Tailwind CSSを使用
- 青色テーマ（`blue-500` / `#3b82f6`）
- レスポンシブ対応
- 状態に応じた色分け：
  - グレー（情報）
  - 赤（警告）
  - 緑（成功）
  - 青（アクション）

## 注意事項

1. **HTTPS必須**: Push通知はHTTPS環境でのみ動作します（localhost除く）
2. **ブラウザサポート**: 以下の機能が必要です
   - Service Worker API
   - Push Manager API
   - Notification API
3. **SSR対応**: `typeof window !== 'undefined'`でクライアントサイドのみで実行
4. **ユーザー操作**: 通知許可はユーザーのアクション（ボタンクリック等）から実行する必要があります
