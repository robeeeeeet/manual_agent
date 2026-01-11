'use client';

import { useState, useEffect } from 'react';
import { QASessionSummary, QASessionListResponse } from '@/types/qa';
import Button from '@/components/ui/Button';

interface QASessionHistoryProps {
  sharedApplianceId: string;
  onSelectSession: (sessionId: string) => void;
  onNewConversation: () => void;
  onClose: () => void;
}

// 相対時間表示（例: 10分前、昨日、3日前）
function formatRelativeTime(isoDate: string): string {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

export function QASessionHistory({
  sharedApplianceId,
  onSelectSession,
  onNewConversation,
  onClose,
}: QASessionHistoryProps) {
  const [sessions, setSessions] = useState<QASessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch(`/api/qa/${sharedApplianceId}/sessions`);
        if (!response.ok) throw new Error('Failed to fetch sessions');

        const data: QASessionListResponse = await response.json();
        setSessions(data.sessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [sharedApplianceId]);

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        読み込み中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-lg border border-gray-200">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">会話履歴</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* セッション一覧 */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            会話履歴がありません
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  {/* アクティブインジケーター */}
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      session.is_active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    {/* 会話タイトル（summary優先、なければfirst_message） */}
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 break-words">
                      {session.summary || session.first_message || '（質問なし）'}
                    </p>
                    {/* メタ情報 */}
                    <p className="text-xs text-gray-500 mt-1">
                      {session.message_count}件のメッセージ • {formatRelativeTime(session.last_activity_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="p-3 border-t border-gray-200">
        <Button
          onClick={onNewConversation}
          className="w-full"
          variant="primary"
        >
          ＋ 新しい会話を始める
        </Button>
      </div>
    </div>
  );
}
