interface QAFeedbackButtonsProps {
  messageId: string;
  onFeedback: (messageId: string, isHelpful: boolean) => void;
}

export function QAFeedbackButtons({ messageId, onFeedback }: QAFeedbackButtonsProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500">この回答は役に立ちましたか？</span>
      <button
        onClick={() => onFeedback(messageId, true)}
        className="px-2 py-1 hover:bg-green-100 rounded text-green-600"
        title="役に立った"
      >
        👍
      </button>
      <button
        onClick={() => onFeedback(messageId, false)}
        className="px-2 py-1 hover:bg-red-100 rounded text-red-600"
        title="役に立たなかった"
      >
        👎
      </button>
    </div>
  );
}
