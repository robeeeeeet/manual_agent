"use client";

import { useState, useEffect, useCallback } from "react";

interface UsePushNotificationResult {
  isSupported: boolean;
  permission: NotificationPermission | null;
  isSubscribed: boolean;
  loading: boolean;
  error: string | null;
  requestPermission: () => Promise<void>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotification(): UsePushNotificationResult {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // 初期化: ブラウザサポート確認とService Worker登録
  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);

      // Service Worker登録（custom-sw.jsはnext-pwa設定と一致させる）
      navigator.serviceWorker
        .register("/custom-sw.js")
        .then((reg) => {
          setRegistration(reg);
          // 購読状態確認
          return reg.pushManager.getSubscription();
        })
        .then((subscription) => {
          setIsSubscribed(subscription !== null);
        })
        .catch((err) => {
          console.error("Service Worker registration failed:", err);
          setError("Service Workerの登録に失敗しました");
        });
    }
  }, []);

  // Push通知購読（内部実装）
  // permissionOverride: requestPermission から呼ばれる場合、ステート更新前なので直接値を渡す
  const subscribeInternal = useCallback(
    async (permissionOverride?: NotificationPermission) => {
      const currentPermission = permissionOverride ?? permission;

      if (!registration) {
        console.error("Subscribe failed: No service worker registration");
        setError("Service Workerが登録されていません");
        return;
      }

      if (currentPermission !== "granted") {
        console.error("Subscribe failed: Permission not granted", currentPermission);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // VAPID公開鍵取得
        const vapidResponse = await fetch("/api/push/vapid-public-key");
        if (!vapidResponse.ok) {
          const errorData = await vapidResponse.json().catch(() => ({}));
          console.error("VAPID key fetch failed:", errorData);
          throw new Error(errorData.error || "VAPID公開鍵の取得に失敗しました");
        }
        const { publicKey } = await vapidResponse.json();

        // Push購読
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // サーバーに購読情報を送信
        const subscribeResponse = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(subscription),
        });

        if (!subscribeResponse.ok) {
          const errorData = await subscribeResponse.json().catch(() => ({}));
          console.error("Subscribe API failed:", errorData);
          throw new Error(errorData.error || "購読登録に失敗しました");
        }

        setIsSubscribed(true);
      } catch (err) {
        console.error("Subscription failed:", err);
        setError(err instanceof Error ? err.message : "通知の購読に失敗しました");
      } finally {
        setLoading(false);
      }
    },
    [registration, permission]
  );

  // 通知許可リクエスト
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError("このブラウザは通知をサポートしていません");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        // 許可されたら自動的に購読
        // ステート更新は非同期なので、result を直接渡す
        await subscribeInternal(result);
      } else if (result === "denied") {
        setError("通知が拒否されました。ブラウザの設定から許可してください。");
      }
    } catch (err) {
      console.error("Permission request failed:", err);
      setError("通知許可のリクエストに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [isSupported, subscribeInternal]);

  // 外部公開用のsubscribe（ステートに依存）
  const subscribe = useCallback(async () => {
    await subscribeInternal();
  }, [subscribeInternal]);

  // Push通知購読解除
  const unsubscribe = useCallback(async () => {
    if (!registration) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      // サーバーに購読解除を通知
      await fetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // ブラウザ側の購読解除
      await subscription.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe failed:", err);
      setError("購読解除に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [registration]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    requestPermission,
    subscribe,
    unsubscribe,
  };
}

// VAPID公開鍵をUint8Arrayに変換するヘルパー関数
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as BufferSource;
}
