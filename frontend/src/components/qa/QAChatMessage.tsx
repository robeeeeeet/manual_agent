import { ChatMessage } from '@/types/qa';
import { QAFeedbackButtons } from './QAFeedbackButtons';

interface QAChatMessageProps {
  message: ChatMessage;
  onFeedback: (messageId: string, isHelpful: boolean) => void;
}

export function QAChatMessage({ message, onFeedback }: QAChatMessageProps) {
  const isUser = message.type === 'user';

  // エラーメッセージ判定（🚫、⚠️、🔒 で始まる）
  const isError = !isUser && /^[🚫⚠️🔒]/.test(message.content);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : isError
              ? 'bg-red-50 text-red-900 border-2 border-red-300'
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

        {/* 整合性警告（セルフチェック失敗時） */}
        {message.needsVerification && (
          <div className="mt-2 flex items-center gap-1 text-amber-600 text-sm">
            <span>⚠️</span>
            <span>この回答は確認が必要かもしれません</span>
          </div>
        )}

        {/* 一般知識使用時の注意書き */}
        {message.usedGeneralKnowledge && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            <span className="mr-1">ℹ️</span>
            <span>
              この回答には説明書に記載のない一般的な情報が含まれています。
              AIの回答は必ずしも正確ではない場合があるため、重要な内容は別途ご確認ください。
            </span>
          </div>
        )}

        {/* フィードバックボタン（エラーメッセージには表示しない） */}
        {!isUser &&
          !isError &&
          message.id !== 'initial' &&
          !message.feedbackGiven && (
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
