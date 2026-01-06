import { ChatMessage } from '@/types/qa';
import { QAFeedbackButtons } from './QAFeedbackButtons';

interface QAChatMessageProps {
  message: ChatMessage;
  onFeedback: (messageId: string, isHelpful: boolean) => void;
}

export function QAChatMessage({ message, onFeedback }: QAChatMessageProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {/* 参照情報 */}
        {message.reference && (
          <p className="text-xs mt-2 opacity-70">
            📖 参照: {message.reference}
          </p>
        )}

        {/* ソース表示 */}
        {message.source && message.source !== 'none' && (
          <p className="text-xs mt-1 opacity-70">
            {message.source === 'qa' && '💡 FAQから回答'}
            {message.source === 'text_cache' && '📄 説明書テキストから回答'}
            {message.source === 'pdf' && '📕 説明書PDFから回答'}
          </p>
        )}

        {/* フィードバックボタン */}
        {!isUser && message.id !== 'initial' && !message.feedbackGiven && (
          <div className="mt-2">
            <QAFeedbackButtons
              messageId={message.id}
              onFeedback={onFeedback}
            />
          </div>
        )}

        {message.feedbackGiven && (
          <p className="text-xs mt-2 text-green-600">
            ✓ フィードバックありがとうございます
          </p>
        )}
      </div>
    </div>
  );
}
