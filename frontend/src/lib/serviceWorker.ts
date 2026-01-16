/**
 * Service Worker登録とPush通知購読のユーティリティ関数
 */

import { logger } from "./logger";

/**
 * VAPID公開鍵をURLセーフなBase64からUint8Arrayに変換
 * Web Push APIで使用するために必要な変換処理
 */
export function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as BufferSource;
}

/**
 * Service Workerを登録
 * next-pwaがService Workerを自動登録するため、通常は手動登録不要
 * ただし、カスタムロジックが必要な場合はこの関数を使用
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  // Service Workerがサポートされているか確認
  if (!('serviceWorker' in navigator)) {
    logger.warn("ServiceWorker", "Service Worker is not supported in this browser");
    return null;
  }

  try {
    // next-pwaが登録したService Workerを取得
    const registration = await navigator.serviceWorker.ready;
    logger.debug("ServiceWorker", "Service Worker registered", { data: registration.scope });
    return registration;
  } catch (error) {
    logger.error("ServiceWorker", "Service Worker registration failed", { error });
    return null;
  }
}

/**
 * Push通知の購読情報を取得
 */
export async function getSubscription(): Promise<PushSubscription | null> {
  const registration = await registerServiceWorker();
  if (!registration) {
    return null;
  }

  try {
    const subscription = await registration.pushManager.getSubscription();
    return subscription;
  } catch (error) {
    logger.error("ServiceWorker", "Failed to get subscription", { error });
    return null;
  }
}

/**
 * Push通知を購読
 * @param vapidPublicKey VAPID公開鍵（URLセーフなBase64形式）
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  // 通知の許可を確認
  if (!('Notification' in window)) {
    logger.warn("ServiceWorker", "Notifications are not supported in this browser");
    return null;
  }

  // 通知権限をリクエスト
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    logger.warn("ServiceWorker", "Notification permission denied");
    return null;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    return null;
  }

  try {
    // 既存の購読があるか確認
    let subscription = await registration.pushManager.getSubscription();

    // 既存の購読がない場合は新規購読
    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // ユーザーに見える通知のみ許可
        applicationServerKey: convertedVapidKey,
      });
      logger.debug("ServiceWorker", "Push subscription created");
    } else {
      logger.debug("ServiceWorker", "Push subscription already exists");
    }

    return subscription;
  } catch (error) {
    logger.error("ServiceWorker", "Failed to subscribe to push", { error });
    return null;
  }
}

/**
 * Push通知の購読を解除
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getSubscription();
  if (!subscription) {
    logger.debug("ServiceWorker", "No active subscription to unsubscribe");
    return true;
  }

  try {
    const successful = await subscription.unsubscribe();
    logger.debug("ServiceWorker", "Push subscription unsubscribed", { data: successful });
    return successful;
  } catch (error) {
    logger.error("ServiceWorker", "Failed to unsubscribe from push", { error });
    return false;
  }
}

/**
 * 通知権限の状態を取得
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (!('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}

/**
 * 通知権限をリクエスト
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (!('Notification' in window)) {
    logger.warn("ServiceWorker", "Notifications are not supported in this browser");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    logger.debug("ServiceWorker", "Notification permission", { data: permission });
    return permission;
  } catch (error) {
    logger.error("ServiceWorker", "Failed to request notification permission", { error });
    return null;
  }
}

/**
 * テスト通知を表示
 * Service Workerが正しく動作しているか確認するためのユーティリティ
 */
export async function showTestNotification(): Promise<void> {
  const registration = await registerServiceWorker();
  if (!registration) {
    logger.error("ServiceWorker", "Service Worker not registered");
    return;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    logger.warn("ServiceWorker", "Notification permission not granted");
    return;
  }

  try {
    await registration.showNotification('テスト通知', {
      body: 'Service Workerが正常に動作しています',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: 'test-notification',
      data: {
        url: '/',
        type: 'test',
        dateOfArrival: Date.now(),
      },
    } as NotificationOptions);
    logger.debug("ServiceWorker", "Test notification shown");
  } catch (error) {
    logger.error("ServiceWorker", "Failed to show test notification", { error });
  }
}
