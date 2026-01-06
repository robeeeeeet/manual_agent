'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, QAStreamEvent, SearchProgress } from '@/types/qa';
import { QAChatMessage } from './QAChatMessage';
import { SearchProgressIndicator } from './SearchProgressIndicator';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface QAChatProps {
  sharedApplianceId: string;
  productName: string;
}

export function QAChat({ sharedApplianceId, productName }: QAChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(
    null
  );
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 初期メッセージ
  useEffect(() => {
    setMessages([
      {
        id: 'initial',
        type: 'assistant',
        content: `${productName}についてご質問があればお聞きください。説明書の内容に基づいてお答えします。`,
        timestamp: new Date(),
      },
    ]);
  }, [productName]);

  // スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        body: JSON.stringify({ question: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
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
                const assistantMessage: ChatMessage = {
                  id: (Date.now() + 1).toString(),
                  type: 'assistant',
                  content: event.answer || '',
                  source: event.source,
                  reference: event.reference,
                  timestamp: new Date(),
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
          <Button type="submit" disabled={isLoading || !input.trim()}>
            送信
          </Button>
        </div>
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
    </div>
  );
}
