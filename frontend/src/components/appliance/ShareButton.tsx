"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface ShareToggleProps {
  applianceId: string;
  isGroupOwned: boolean;
  hasGroup: boolean;
  isOriginalOwner?: boolean; // True if current user is the original owner of the appliance
  onShareChange?: () => void;
  className?: string;
}

/**
 * ShareToggle - Toggle switch for sharing appliances with group
 *
 * Displays a toggle switch based on ownership and group membership:
 * - Personal owned + has group: Toggle OFF, can turn ON (share)
 * - Group owned + is original owner: Toggle ON, can turn OFF (unshare)
 * - Group owned + not original owner: Toggle ON, disabled (read-only indicator)
 * - No group: Hidden
 */
export default function ShareToggle({
  applianceId,
  isGroupOwned,
  hasGroup,
  isOriginalOwner = false,
  onShareChange,
  className = "",
}: ShareToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't render if user is not in a group and appliance is not group-owned
  if (!hasGroup && !isGroupOwned) {
    return null;
  }

  const handleShare = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/appliances/${applianceId}/share`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "共有に失敗しました");
      }

      onShareChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "共有に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnshare = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/appliances/${applianceId}/unshare`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "共有解除に失敗しました");
      }

      setShowConfirmModal(false);
      onShareChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "共有解除に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleClick = () => {
    if (isLoading) return;

    if (isGroupOwned) {
      // Currently shared, user wants to unshare
      if (isOriginalOwner) {
        setError(null);
        setShowConfirmModal(true);
      }
      // Non-owners cannot toggle off
    } else {
      // Currently not shared, user wants to share
      handleShare();
    }
  };

  // Determine if toggle is disabled
  const isDisabled = isLoading || (isGroupOwned && !isOriginalOwner);

  // Determine toggle state
  const isOn = isGroupOwned;

  return (
    <>
      <div className={`relative flex items-center gap-2 ${className}`}>
        {/* Label */}
        <span className="text-sm text-gray-600">共有</span>

        {/* Toggle switch */}
        <button
          type="button"
          onClick={handleToggleClick}
          disabled={isDisabled}
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
            border-2 border-transparent transition-colors duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${isOn ? "bg-blue-600" : "bg-gray-200"}
            ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}
          `}
          role="switch"
          aria-checked={isOn}
          aria-label={isOn ? "共有中" : "未共有"}
        >
          {/* Toggle handle */}
          <span
            aria-hidden="true"
            className={`
              pointer-events-none inline-block h-5 w-5 transform rounded-full
              bg-white shadow ring-0 transition duration-200 ease-in-out
              ${isOn ? "translate-x-5" : "translate-x-0"}
            `}
          >
            {/* Loading indicator inside handle */}
            {isLoading && (
              <svg
                className="absolute inset-0 m-auto w-3 h-3 animate-spin text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
          </span>
        </button>

        {/* Read-only indicator for non-owners */}
        {isGroupOwned && !isOriginalOwner && (
          <span className="text-xs text-gray-400">(他のメンバーが共有)</span>
        )}

        {/* Error tooltip */}
        {error && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs whitespace-nowrap z-10">
            {error}
          </div>
        )}
      </div>

      {/* Confirmation Modal for unsharing */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            共有を解除しますか？
          </h3>
          <p className="text-gray-600 mb-4">
            この家電を個人所有に戻します。他のグループメンバーはこの家電にアクセスできなくなります。
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleUnshare}
              isLoading={isLoading}
            >
              共有解除
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// Export with original name for backwards compatibility
export { ShareToggle as ShareButton };
