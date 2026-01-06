'use client';

import { useState, useEffect } from 'react';
import { QAChat } from './QAChat';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { QAGetResponse, QAGenerateResponse } from '@/types/qa';

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
      <h2 className="text-xl font-bold mb-4">💬 製品Q&A</h2>
      <QAChat sharedApplianceId={sharedApplianceId} productName={productName} />
    </Card>
  );
}
