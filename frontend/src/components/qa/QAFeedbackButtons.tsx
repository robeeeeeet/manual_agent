'use client';

import { useState } from 'react';

interface QAFeedbackButtonsProps {
  messageId: string;
  onFeedback: (messageId: string, isHelpful: boolean) => Promise<void>;
}

export function QAFeedbackButtons({ messageId, onFeedback }: QAFeedbackButtonsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async (isHelpful: boolean) => {
    setIsSubmitting(true);
    try {
      await onFeedback(messageId, isHelpful);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-sm text-gray-700 font-medium mb-2">解決しましたか？</p>
      <div className="flex gap-2">
        {isSubmitting ? (
          <div className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-gray-500">
            <svg
              className="animate-spin h-4 w-4"
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
            <span>送信中...</span>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleClick(true)}
              disabled={isSubmitting}
              className="flex-1 px-3 py-1.5 text-sm bg-green-50 border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium whitespace-nowrap min-w-[60px] disabled:opacity-50"
            >
              はい
            </button>
            <button
              onClick={() => handleClick(false)}
              disabled={isSubmitting}
              className="flex-1 px-3 py-1.5 text-sm bg-red-50 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium whitespace-nowrap min-w-[60px] disabled:opacity-50"
            >
              いいえ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
