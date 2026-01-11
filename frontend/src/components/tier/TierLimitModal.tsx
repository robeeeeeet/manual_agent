"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

interface TierLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  currentUsage: number;
  limit: number;
  tierName: string;
}

export default function TierLimitModal({
  isOpen,
  onClose,
  message,
  currentUsage,
  limit,
  tierName,
}: TierLimitModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="dialog">
      <div className="p-6">
        {/* Warning icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full">
          <svg
            className="w-6 h-6 text-yellow-600"
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

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          利用制限に達しました
        </h2>

        {/* Current tier */}
        <p className="text-sm text-gray-600 text-center mb-4">
          現在のプラン: <span className="font-semibold">{tierName}</span>
        </p>

        {/* Message */}
        <p className="text-gray-700 text-center mb-4">{message}</p>

        {/* Usage stats */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">本日の利用回数</span>
            <span className="text-lg font-bold text-red-600">
              {currentUsage} / {limit}
            </span>
          </div>
        </div>

        {/* Upgrade message */}
        <p className="text-sm text-gray-600 text-center mb-6">
          プランのアップグレードについては、サポートまでお問い合わせください。
        </p>

        {/* Close button */}
        <div className="flex justify-center">
          <Button onClick={onClose} variant="primary" className="w-full">
            閉じる
          </Button>
        </div>
      </div>
    </Modal>
  );
}
