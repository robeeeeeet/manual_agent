/**
 * Service Worker ユーティリティの使用例
 *
 * このファイルは実装例を示すためのもので、実際のコンポーネントでは
 * 必要な関数をインポートして使用してください。
 */

import {
  subscribeToPush,
  unsubscribeFromPush,
  getSubscription,
  getNotificationPermission,
  requestNotificationPermission,
  showTestNotification,
} from './serviceWorker';

/**
 * 使用例1: Push通知を購読する
 *
 * コンポーネントやページで以下のように使用します：
 *
 * ```tsx
 * 'use client';
 *
 * import { subscribeToPush } from '@/lib/serviceWorker';
 *
 * export default function NotificationSettings() {
 *   const handleSubscribe = async () => {
 *     // VAPID公開鍵を環境変数から取得
 *     const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
 *
 *     if (!vapidPublicKey) {
 *       console.error('VAPID public key not found');
 *       return;
 *     }
 *
 *     // Push通知を購読
 *     const subscription = await subscribeToPush(vapidPublicKey);
 *
 *     if (subscription) {
 *       // 購読情報をバックエンドに送信してDBに保存
 *       await fetch('/api/notifications/subscribe', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           subscription: subscription.toJSON(),
 *         }),
 *       });
 *     }
 *   };
 *
 *   return (
 *     <button onClick={handleSubscribe}>
 *       通知を有効にする
 *     </button>
 *   );
 * }
 * ```
 */
export async function exampleSubscribe() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  const subscription = await subscribeToPush(vapidPublicKey);

  if (subscription) {
    console.log('Subscription:', subscription.toJSON());
    // バックエンドに送信
    // await saveSubscriptionToBackend(subscription);
  }
}

/**
 * 使用例2: 購読を解除する
 *
 * ```tsx
 * import { unsubscribeFromPush } from '@/lib/serviceWorker';
 *
 * const handleUnsubscribe = async () => {
 *   const success = await unsubscribeFromPush();
 *
 *   if (success) {
 *     // バックエンドから購読情報を削除
 *     await fetch('/api/notifications/unsubscribe', {
 *       method: 'DELETE',
 *     });
 *   }
 * };
 * ```
 */
export async function exampleUnsubscribe() {
  const success = await unsubscribeFromPush();
  console.log('Unsubscribe success:', success);
}

/**
 * 使用例3: 現在の購読状態を確認する
 *
 * ```tsx
 * import { getSubscription, getNotificationPermission } from '@/lib/serviceWorker';
 *
 * const checkNotificationStatus = async () => {
 *   // 通知権限の確認
 *   const permission = getNotificationPermission();
 *   console.log('Permission:', permission); // 'granted' | 'denied' | 'default'
 *
 *   // 購読状態の確認
 *   const subscription = await getSubscription();
 *   console.log('Is subscribed:', !!subscription);
 * };
 * ```
 */
export async function exampleCheckStatus() {
  const permission = getNotificationPermission();
  const subscription = await getSubscription();

  console.log('Permission:', permission);
  console.log('Is subscribed:', !!subscription);

  return {
    permission,
    isSubscribed: !!subscription,
  };
}

/**
 * 使用例4: 通知権限をリクエストする
 *
 * ```tsx
 * import { requestNotificationPermission } from '@/lib/serviceWorker';
 *
 * const handleRequestPermission = async () => {
 *   const permission = await requestNotificationPermission();
 *
 *   if (permission === 'granted') {
 *     console.log('通知が許可されました');
 *   } else if (permission === 'denied') {
 *     console.log('通知が拒否されました');
 *   }
 * };
 * ```
 */
export async function exampleRequestPermission() {
  const permission = await requestNotificationPermission();
  console.log('Permission result:', permission);
  return permission;
}

/**
 * 使用例5: テスト通知を表示する
 *
 * ```tsx
 * import { showTestNotification } from '@/lib/serviceWorker';
 *
 * const handleTestNotification = async () => {
 *   await showTestNotification();
 * };
 * ```
 */
export async function exampleTestNotification() {
  await showTestNotification();
}

/**
 * 使用例6: React Hookとして使用する
 *
 * ```tsx
 * import { useState, useEffect } from 'react';
 * import { getSubscription, subscribeToPush, unsubscribeFromPush } from '@/lib/serviceWorker';
 *
 * export function useNotifications() {
 *   const [isSubscribed, setIsSubscribed] = useState(false);
 *   const [loading, setLoading] = useState(true);
 *
 *   useEffect(() => {
 *     checkSubscription();
 *   }, []);
 *
 *   const checkSubscription = async () => {
 *     const subscription = await getSubscription();
 *     setIsSubscribed(!!subscription);
 *     setLoading(false);
 *   };
 *
 *   const subscribe = async () => {
 *     setLoading(true);
 *     const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
 *     const subscription = await subscribeToPush(vapidPublicKey);
 *
 *     if (subscription) {
 *       // DBに保存
 *       await fetch('/api/notifications/subscribe', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({ subscription: subscription.toJSON() }),
 *       });
 *       setIsSubscribed(true);
 *     }
 *     setLoading(false);
 *   };
 *
 *   const unsubscribe = async () => {
 *     setLoading(true);
 *     const success = await unsubscribeFromPush();
 *
 *     if (success) {
 *       await fetch('/api/notifications/unsubscribe', { method: 'DELETE' });
 *       setIsSubscribed(false);
 *     }
 *     setLoading(false);
 *   };
 *
 *   return { isSubscribed, loading, subscribe, unsubscribe };
 * }
 * ```
 */
