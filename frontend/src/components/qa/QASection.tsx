'use client';

import { useState, useEffect } from 'react';
import { QAChat } from './QAChat';
import { QASessionHistory } from './QASessionHistory';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { QAGetResponse, QAGenerateResponse, ChatMessage, QASessionDetail } from '@/types/qa';

interface QASectionProps {
  sharedApplianceId: string;
  manufacturer: string;
  modelNumber: string;
  hasPdf: boolean;
}

export function QASection({ sharedApplianceId, manufacturer, modelNumber, hasPdf }: QASectionProps) {
  const [qaExists, setQaExists] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表示モード: 'chat' | 'history'
  const [viewMode, setViewMode] = useState<'chat' | 'history'>('chat');
  // 現在のセッションID
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  // 初期メッセージ（過去セッション復元用）
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);

  const productName = `${manufacturer} ${modelNumber}`;

  // QA存在確認
  useEffect(() => {
    const checkQA = async () => {
      try {
        const response = await fetch(`/api/qa/${sharedApplianceId}`);
        if (response.ok) {
          const data: QAGetResponse = await response.json();
          setQaExists(data.exists);
        }
      } catch (err) {
        console.error('Error checking QA:', err);
      }
    };

    checkQA();
  }, [sharedApplianceId]);

  // QA生成
  const handleGenerateQA = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/qa/${sharedApplianceId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_regenerate: false }),
      });

      if (!response.ok) {
        throw new Error('QA生成に失敗しました');
      }

      const data: QAGenerateResponse = await response.json();
      if (data.success) {
        setQaExists(true);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsGenerating(false);
    }
  };

  // セッション選択時の処理
  const handleSelectSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/qa/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session');

      const session: QASessionDetail = await response.json();

      // メッセージをChatMessage形式に変換（source/referenceも含める）
      const messages: ChatMessage[] = session.messages.map((msg) => ({
        id: msg.id,
        type: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        source: msg.source ?? undefined,
        reference: msg.reference,
        timestamp: new Date(msg.created_at),
      }));

      setCurrentSessionId(sessionId);
      setInitialMessages(messages);
      setViewMode('chat');
    } catch (err) {
      console.error('Error loading session:', err);
    }
  };

  // 新しい会話を開始
  const handleNewConversation = async () => {
    try {
      // セッションリセットAPIを呼び出し
      const response = await fetch(`/api/qa/${sharedApplianceId}/reset-session`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reset session');

      const data = await response.json();

      setCurrentSessionId(data.new_session_id || undefined);
      setInitialMessages([]);
      setViewMode('chat');
    } catch (err) {
      console.error('Error creating new session:', err);
      // エラーでも新しい会話は開始できるようにする
      setCurrentSessionId(undefined);
      setInitialMessages([]);
      setViewMode('chat');
    }
  };

  // PDFがない場合
  if (!hasPdf) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">💬 製品Q&A</h2>
        <p className="text-gray-500">
          説明書PDFが登録されていないため、Q&A機能は利用できません。
        </p>
      </Card>
    );
  }

  // ローディング中
  if (qaExists === null) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">💬 製品Q&A</h2>
        <div className="text-gray-500">読み込み中...</div>
      </Card>
    );
  }

  // QA未生成
  if (!qaExists) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">💬 製品Q&A</h2>
        <p className="text-gray-600 mb-4">
          この製品のQ&Aは自動生成されていません。生成しますか？
        </p>
        <p className="text-sm text-gray-500 mb-4">
          ※ 新規登録時は自動的にQ&Aが作成されます。このデータは古い登録のため、手動で生成できます。
        </p>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <Button onClick={handleGenerateQA} disabled={isGenerating} isLoading={isGenerating}>
          {isGenerating ? 'Q&Aを生成中...' : 'Q&Aを生成する'}
        </Button>
      </Card>
    );
  }

  // QA存在 - チャット表示
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">💬 製品Q&A</h2>
        {viewMode === 'chat' && (
          <button
            onClick={() => setViewMode('history')}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            会話履歴
          </button>
        )}
      </div>

      {viewMode === 'chat' ? (
        <QAChat
          sharedApplianceId={sharedApplianceId}
          productName={productName}
          sessionId={currentSessionId}
          initialMessages={initialMessages.length > 0 ? initialMessages : undefined}
          onSessionIdChange={setCurrentSessionId}
        />
      ) : (
        <QASessionHistory
          sharedApplianceId={sharedApplianceId}
          onSelectSession={handleSelectSession}
          onNewConversation={handleNewConversation}
          onClose={() => setViewMode('chat')}
        />
      )}
    </Card>
  );
}
