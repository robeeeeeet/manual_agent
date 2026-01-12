'use client';

import { SearchProgress } from '@/types/qa';

interface SearchProgressIndicatorProps {
  progress: SearchProgress | null;
}

const STEP_LABELS = {
  1: 'QAデータベース検索',
  2: 'テキスト検索',
  3: 'PDF詳細分析',
};

export function SearchProgressIndicator({
  progress,
}: SearchProgressIndicatorProps) {
  if (!progress) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-2">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="text-sm">準備中...</span>
      </div>
    );
  }

  // 検証ステップかどうか（1.5, 2.5, 3.5）
  const isVerifyingStep = progress.currentStep % 1 !== 0;
  // 現在のメインステップ（小数点以下切り捨て）
  const mainStep = Math.floor(progress.currentStep);

  return (
    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="text-sm font-medium text-blue-700">
          {progress.stepName}
        </span>
        {isVerifyingStep && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            検証中
          </span>
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((step) => {
          const isCompleted = progress.completedSteps.includes(step);
          // 検証ステップの場合、そのメインステップを現在として扱う
          const isCurrent = isVerifyingStep
            ? mainStep === step
            : progress.currentStep === step;
          const isPending = !isCompleted && !isCurrent;

          return (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-300 relative
                    ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step
                  )}
                  {/* 検証中インジケーター */}
                  {isCurrent && isVerifyingStep && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isPending ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {STEP_LABELS[step as keyof typeof STEP_LABELS]}
                </span>
              </div>
              {step < 3 && (
                <div
                  className={`w-8 h-0.5 mx-1 transition-colors duration-300 ${
                    progress.completedSteps.includes(step)
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        {isVerifyingStep
          ? '回答の品質を確認しています...'
          : 'より詳しい情報源を順番に検索しています...'}
      </p>
    </div>
  );
}
