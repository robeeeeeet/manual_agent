"use client";

import { useEffect } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { usePushNotification } from "@/hooks/usePushNotification";
import { useDeviceContext, getNotificationSettingsText } from "@/hooks/useDeviceContext";

interface NotificationPermissionModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export default function NotificationPermissionModal({
  isOpen,
  onComplete,
}: NotificationPermissionModalProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    requestPermission,
  } = usePushNotification();
  const { deviceType, appMode } = useDeviceContext();
  const settingsText = getNotificationSettingsText(deviceType, appMode);

  // If already subscribed, auto-complete immediately
  useEffect(() => {
    if (isOpen && isSubscribed) {
      onComplete();
    }
  }, [isOpen, isSubscribed, onComplete]);

  const handleEnableNotifications = async () => {
    await requestPermission();
    // After requestPermission completes, if permission was granted and subscribed,
    // the useEffect above will call onComplete
    // If denied or failed, user can choose to skip
  };

  const handleSkip = () => {
    onComplete();
  };

  // If not open or already subscribed, don't render
  if (!isOpen || isSubscribed) {
    return null;
  }

  // Render content based on notification state
  const renderContent = () => {
    // Browser doesn't support notifications
    if (!isSupported) {
      return (
        <>
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
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
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            通知は利用できません
          </h2>
          <p className="text-gray-600 mb-6">
            お使いのブラウザは通知機能をサポートしていません
          </p>
          <Button onClick={handleSkip} className="w-full" size="lg">
            OK
          </Button>
        </>
      );
    }

    // Notification permission was denied
    if (permission === "denied") {
      return (
        <>
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
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
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            通知がブロックされています
          </h2>
          <p className="text-gray-600 mb-6">
            {settingsText}
          </p>
          <Button onClick={handleSkip} className="w-full" size="lg">
            OK
          </Button>
        </>
      );
    }

    // Default: show enable notification prompt
    return (
      <>
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-blue-600"
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
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          通知を設定しますか?
        </h2>
        <p className="text-gray-600 mb-4">
          家電のメンテナンス予定日が近づいたら通知でお知らせします
        </p>
        <ul className="text-left text-sm text-gray-500 mb-6 space-y-2">
          <li className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            フィルター交換時期の通知
          </li>
          <li className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            定期点検のリマインド
          </li>
          <li className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            期限超過のアラート
          </li>
        </ul>

        <Button
          onClick={handleEnableNotifications}
          className="w-full mb-3"
          size="lg"
          isLoading={loading}
        >
          通知を有効にする
        </Button>

        <button
          onClick={handleSkip}
          className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
          disabled={loading}
        >
          あとで設定する
        </button>

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
      </>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} variant="dialog">
      <div className="p-6 text-center">{renderContent()}</div>
    </Modal>
  );
}
