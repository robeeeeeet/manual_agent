"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import type { MaintenanceSchedule } from "@/types/appliance";

interface MaintenanceCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: MaintenanceSchedule | null;
  applianceName?: string;
  onComplete: () => void;
}

export default function MaintenanceCompleteModal({
  isOpen,
  onClose,
  schedule,
  applianceName,
  onComplete,
}: MaintenanceCompleteModalProps) {
  const [completionNotes, setCompletionNotes] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (!isCompleting) {
      setCompletionNotes("");
      setError(null);
      onClose();
    }
  };

  const handleComplete = async () => {
    if (!schedule) return;

    setIsCompleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/appliances/maintenance-schedules/${schedule.id}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: completionNotes || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "完了記録に失敗しました");
      }

      // Reset state and notify parent
      setCompletionNotes("");
      onComplete();
      onClose();
    } catch (err) {
      console.error("Complete error:", err);
      setError(err instanceof Error ? err.message : "完了記録に失敗しました");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} variant="dialog">
      <div className="p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          メンテナンスを完了する
        </h3>
        {schedule && (
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              <span className="font-medium text-gray-900">
                {schedule.task_name}
              </span>
              {applianceName && (
                <span className="text-sm text-gray-500 block mt-1">
                  {applianceName}
                </span>
              )}
              <br />
              を完了しますか？
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Notes input */}
            <div>
              <label
                htmlFor="completion-notes"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                メモ（任意）
              </label>
              <textarea
                id="completion-notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="作業の内容や気づいた点などを記録できます"
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                disabled={isCompleting}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
            disabled={isCompleting}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleComplete}
            isLoading={isCompleting}
            className="flex-1"
          >
            完了する
          </Button>
        </div>
      </div>
    </Modal>
  );
}
