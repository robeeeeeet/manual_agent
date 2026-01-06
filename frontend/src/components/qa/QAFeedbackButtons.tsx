interface QAFeedbackButtonsProps {
  messageId: string;
  onFeedback: (messageId: string, isHelpful: boolean) => void;
}

export function QAFeedbackButtons({ messageId, onFeedback }: QAFeedbackButtonsProps) {
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-sm text-gray-700 font-medium mb-3">解決しましたか？</p>
      <div className="flex gap-3">
        <button
          onClick={() => onFeedback(messageId, true)}
          className="flex-1 px-4 py-2 bg-green-50 border border-green-300 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
        >
          はい ✓
        </button>
        <button
          onClick={() => onFeedback(messageId, false)}
          className="flex-1 px-4 py-2 bg-red-50 border border-red-300 text-red-700 rounded-lg hover:bg-red-100 transition-colors font-medium"
        >
          いいえ ✗
        </button>
      </div>
    </div>
  );
}
