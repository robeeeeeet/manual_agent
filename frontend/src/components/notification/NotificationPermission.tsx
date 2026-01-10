"use client";

import { useState } from "react";
import { usePushNotification } from "@/hooks/usePushNotification";
import { useAuth } from "@/contexts/AuthContext";
import { useDeviceContext, getNotificationSettingsText } from "@/hooks/useDeviceContext";

// Check if user is allowed to send test notifications
const ALLOWED_TEST_USERS = process.env.NEXT_PUBLIC_ALLOWED_TEST_NOTIFICATION_USERS || "";

function isAllowedTestUser(email: string | undefined): boolean {
  if (!email) return false;
  if (!ALLOWED_TEST_USERS) return false;
  const allowedEmails = ALLOWED_TEST_USERS.split(",").map((e) => e.trim().toLowerCase());
  return allowedEmails.includes(email.toLowerCase());
}

export default function NotificationPermission() {
  const { user } = useAuth();
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    requestPermission,
    unsubscribe,
  } = usePushNotification();
  const { deviceType, appMode } = useDeviceContext();

  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const canSendTestNotification = isAllowedTestUser(user?.email);
  const settingsText = getNotificationSettingsText(deviceType, appMode);

  const sendTestNotification = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "テスト通知の送信に失敗しました");
      }
      const data = await response.json();
      if (data.success > 0) {
        setTestResult("テスト通知を送信しました");
      } else if (data.failed > 0) {
        setTestResult("通知の送信に失敗しました");
      } else {
        setTestResult("送信対象の購読がありません");
      }
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setTestLoading(false);
    }
  };

  // ブラウザが通知をサポートしていない場合
  if (!isSupported) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-700">通知は利用できません</p>
            <p className="text-sm text-gray-500 mt-1">
              お使いのブラウザは通知機能をサポートしていません
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 通知が拒否されている場合
  if (permission === "denied") {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-red-700">通知が無効になっています</p>
            <p className="text-sm text-red-600 mt-1">
              {settingsText}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 通知が許可済みで購読している場合
  if (permission === "granted" && isSubscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-700">通知は有効です</p>
              <p className="text-sm text-green-600 mt-1">
                メンテナンスのリマインドを受け取ります
              </p>
              <div className="mt-3 flex items-center gap-3">
                {canSendTestNotification && (
                  <button
                    onClick={sendTestNotification}
                    disabled={testLoading}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {testLoading ? "送信中..." : "テスト通知を送信"}
                  </button>
                )}
                <button
                  onClick={unsubscribe}
                  disabled={loading}
                  className="text-sm text-green-700 hover:text-green-800 underline disabled:opacity-50"
                >
                  解除
                </button>
              </div>
              {testResult && (
                <p className={`text-sm mt-2 ${testResult.includes("失敗") || testResult.includes("エラー") ? "text-red-600" : "text-green-600"}`}>
                  {testResult}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 通知を有効化するボタンを表示
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-700">
            メンテナンスリマインド通知
          </p>
          <p className="text-sm text-blue-600 mt-1">
            家電のメンテナンス予定日が近づいたら通知でお知らせします
          </p>
          <button
            onClick={requestPermission}
            disabled={loading}
            className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? "処理中..." : "通知を有効にする"}
          </button>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
