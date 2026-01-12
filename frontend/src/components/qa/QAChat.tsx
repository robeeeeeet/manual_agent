'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChatMessage,
  QAStreamEvent,
  SearchProgress,
  QAError,
  QABlockedError,
  InvalidQuestionError,
} from '@/types/qa';
import { TierLimitError } from '@/types/user';
import { QAChatMessage } from './QAChatMessage';
import { SearchProgressIndicator } from './SearchProgressIndicator';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TierLimitModal from '@/components/tier/TierLimitModal';

interface QAChatProps {
  sharedApplianceId: string;
  productName: string;
  sessionId?: string;
  initialMessages?: ChatMessage[];
  onSessionIdChange?: (sessionId: string) => void;
  onNewConversation?: () => void;
}

// 相対時間を計算（○時間○分）
function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const target = new Date(isoDate);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return '制限解除されました';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `あと${hours}時間${minutes}分`;
  } else {
    return `あと${minutes}分`;
  }
}

// エラーメッセージを作成
function createErrorMessage(error: QAError): ChatMessage {
  let content = '';

  if ('code' in error && error.code === 'QA_BLOCKED') {
    const blockedError = error as QABlockedError;
    const relativeTime = getRelativeTime(blockedError.restricted_until);
    content = `🚫 QA機能が一時的に制限されています

制限解除時刻: ${relativeTime}
違反回数: ${blockedError.violation_count}回

不適切な質問が続いたため、一時的にQA機能のご利用を制限させていただいております。
制限解除後は、製品に関する適切な質問をお願いします。`;
  } else if ('code' in error && error.code === 'INVALID_QUESTION') {
    const invalidError = error as InvalidQuestionError;
    const violationText =
      invalidError.violation_type === 'off_topic'
        ? '製品に関係のない質問'
        : invalidError.violation_type === 'inappropriate'
          ? '不適切な内容の質問'
          : 'システムへの攻撃的な質問';

    content = `⚠️ この質問は受け付けられませんでした

理由: ${violationText}
詳細: ${invalidError.reason}

製品の使い方やメンテナンス方法など、説明書の内容に関連する質問をお願いします。

⚠️ ご注意: 関係のない質問を繰り返すと、QA機能のご利用が一時的に制限されます。`;
  } else {
    content = error.error || '不明なエラーが発生しました。';
  }

  return {
    id: Date.now().toString(),
    type: 'assistant',
    content,
    timestamp: new Date(),
  };
}

export function QAChat({
  sharedApplianceId,
  productName,
  sessionId,
  initialMessages,
  onSessionIdChange,
  onNewConversation,
}: QAChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(
    null
  );
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(sessionId);
  const [tierLimitError, setTierLimitError] = useState<TierLimitError | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期メッセージ
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    } else {
      setMessages([
        {
          id: 'initial',
          type: 'assistant',
          content: `${productName}についてご質問があればお聞きください。説明書の内容に基づいてお答えします。`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [productName, initialMessages]);

  // sessionId propの変更を監視
  useEffect(() => {
    setCurrentSessionId(sessionId);
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setSearchProgress(null);

    try {
      const response = await fetch(`/api/qa/${sharedApplianceId}/ask-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          session_id: currentSessionId,
        }),
      });

      if (!response.ok) {
        // エラーレスポンスをパース
        const errorData: QAError = await response.json();

        // 401 Unauthorized
        if (response.status === 401) {
          const errorMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: `🔒 認証が必要です

QA機能をご利用いただくには、ログインが必要です。
お手数ですが、ログインページからログインしてください。`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          setSearchProgress(null);
          setIsLoading(false);
          return;
        }

        // 403 TIER_LIMIT_EXCEEDED
        if (response.status === 403 && errorData.error === 'TIER_LIMIT_EXCEEDED') {
          setTierLimitError(errorData as TierLimitError);
          setSearchProgress(null);
          setIsLoading(false);
          return;
        }

        // 403 QA_BLOCKED または 400 INVALID_QUESTION
        if (response.status === 403 || response.status === 400) {
          const errorMessage = createErrorMessage(errorData);
          setMessages((prev) => [...prev, errorMessage]);
          setSearchProgress(null);
          setIsLoading(false);
          return;
        }

        // その他のエラー
        throw new Error(errorData.error || 'Failed to get answer');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      const completedSteps: number[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event: QAStreamEvent = JSON.parse(jsonStr);

              if (event.event === 'step_start' && event.step && event.step_name) {
                setSearchProgress({
                  currentStep: event.step,
                  stepName: event.step_name,
                  completedSteps: [...completedSteps],
                });
              } else if (event.event === 'step_complete' && event.step) {
                completedSteps.push(event.step);
                setSearchProgress((prev) =>
                  prev
                    ? { ...prev, completedSteps: [...completedSteps] }
                    : null
                );
              } else if (event.event === 'answer') {
                // セッションIDを更新
                if (event.session_id && event.session_id !== currentSessionId) {
                  setCurrentSessionId(event.session_id);
                  onSessionIdChange?.(event.session_id);
                }

                const assistantMessage: ChatMessage = {
                  id: (Date.now() + 1).toString(),
                  type: 'assistant',
                  content: event.answer || '',
                  source: event.source,
                  reference: event.reference,
                  timestamp: new Date(),
                  // セルフチェック関連
                  selfCheckScore: event.self_check_score,
                  needsVerification: event.needs_verification,
                  usedGeneralKnowledge: event.used_general_knowledge,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setSearchProgress(null);
              } else if (event.event === 'error') {
                throw new Error(event.error || 'Unknown error');
              }
            } catch (parseError) {
              console.error('Failed to parse SSE event:', parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error asking question:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content:
          '申し訳ありません。回答の取得中にエラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setSearchProgress(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (messageId: string, isHelpful: boolean) => {
    const message = messages.find((m) => m.id === messageId);
    const prevUserMessage = messages[messages.findIndex((m) => m.id === messageId) - 1];

    if (!message || message.type !== 'assistant' || !prevUserMessage) return;

    try {
      const response = await fetch(`/api/qa/${sharedApplianceId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: prevUserMessage.content,
          answer: message.content,
          is_helpful: isHelpful,
          correction: null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      const data = await response.json();

      if (data.deleted) {
        // QA項目が削除された場合、モーダルで通知
        setShowDeletedModal(true);
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedbackGiven: true } : m
        )
      );
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('フィードバックの送信に失敗しました。もう一度お試しください。');
    }
  };

  // サンプル質問
  const sampleQuestions = [
    'お手入れの方法を教えてください',
    '電源が入らない場合はどうすればいいですか？',
    '使い方の基本を教えてください',
  ];

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-lg border border-gray-200">
      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <QAChatMessage
            key={message.id}
            message={message}
            onFeedback={handleFeedback}
          />
        ))}

        {isLoading && (
          <SearchProgressIndicator progress={searchProgress} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* サンプル質問（メッセージが初期状態のとき） */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <p className="text-sm text-gray-500 mb-2">よくある質問:</p>
          <div className="flex flex-wrap gap-2">
            {sampleQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => setInput(question)}
                className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 入力エリア */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="質問を入力してください..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="!p-2 !min-w-0"
            aria-label="送信"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </Button>
        </div>
        {/* 新しい会話を始めるボタン（会話が進んでいる場合のみ表示） */}
        {onNewConversation && messages.length > 1 && (
          <button
            type="button"
            onClick={onNewConversation}
            className="mt-2 text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新しい会話を始める
          </button>
        )}
      </form>

      {/* QA削除通知モーダル */}
      <Modal
        isOpen={showDeletedModal}
        onClose={() => setShowDeletedModal(false)}
        variant="dialog"
      >
        <div className="p-6">
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
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-center text-gray-900 mb-2">
            QAが削除されました
          </h3>
          <p className="text-sm text-gray-600 text-center mb-6">
            この回答は複数の低評価を受けたため、QAリストから削除されました。
            <br />
            ご協力ありがとうございます。
          </p>
          <Button
            onClick={() => setShowDeletedModal(false)}
            className="w-full"
          >
            閉じる
          </Button>
        </div>
      </Modal>

      {/* Tier Limit Modal */}
      {tierLimitError && (
        <TierLimitModal
          isOpen={!!tierLimitError}
          onClose={() => setTierLimitError(null)}
          message={tierLimitError.message}
          currentUsage={tierLimitError.current_usage}
          limit={tierLimitError.limit}
          tierName={tierLimitError.tier_display_name}
        />
      )}
    </div>
  );
}
