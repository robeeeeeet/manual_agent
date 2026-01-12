"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";

// PDFViewer は DOM API を使用するため、SSR を無効にして動的インポート
const PDFViewer = dynamic(
  () => import("@/components/pdf/PDFViewer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    ),
  }
);

// テスト用：特定ユーザーのみアクセス可
const ALLOWED_EMAILS = ["notsuka0217@gmail.com"];

export default function PDFTestPage() {
  const { user, loading: authLoading } = useAuth();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(10); // 初期ページ（テスト用）
  const [showFullScreen, setShowFullScreen] = useState(false);

  const isAllowed = user && ALLOWED_EMAILS.includes(user.email || "");

  useEffect(() => {
    if (authLoading) return;
    if (!isAllowed) {
      setLoading(false);
      return;
    }

    const fetchPdfUrl = async () => {
      try {
        const response = await fetch("/api/pdf-test");
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        setPdfUrl(data.signed_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();
  }, [authLoading, isAllowed]);

  // 認証待ち
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">認証を確認中...</p>
      </div>
    );
  }

  // 未認証 or 許可されていないユーザー
  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            アクセス権限がありません
          </h1>
          <p className="text-gray-500">
            このページはテスト用のため、特定のユーザーのみアクセスできます。
          </p>
        </div>
      </div>
    );
  }

  // フルスクリーン表示
  if (showFullScreen && pdfUrl) {
    return (
      <PDFViewer
        url={pdfUrl}
        initialPage={pageNumber}
        fullScreen={true}
        onClose={() => setShowFullScreen(false)}
        key={`fullscreen-${pageNumber}`}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
          PDF ビューア テスト
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mb-4">
          react-pdf を使用した PDF ビューアのテストページです。
          iOS Safari / PWA でも指定ページを直接表示できることを確認してください。
        </p>

        {/* ページ番号選択 */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-gray-700 mb-3">表示ページ設定</h2>
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-600">初期表示ページ:</label>
            <input
              type="number"
              min={1}
              value={pageNumber}
              onChange={(e) => setPageNumber(parseInt(e.target.value) || 1)}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">ページ</span>
          </div>
        </div>

        {/* 読み込み中 */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-500">PDF URLを取得中...</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* フルスクリーン表示ボタン */}
        {pdfUrl && !loading && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="font-semibold text-gray-700 mb-3">
              日立 洗濯機 BD-SX120JL 取扱説明書
            </h2>
            <button
              onClick={() => setShowFullScreen(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
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
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              PDF をフルスクリーンで表示（{pageNumber}ページ目から）
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              ※ react-pdf 方式：iOS Safari / PWA でも指定ページを直接表示
            </p>
          </div>
        )}

        {/* 比較用：従来のリンク方式 */}
        {pdfUrl && !loading && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="font-semibold text-gray-700 mb-3">
              比較: 従来の #page=N 方式
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              以下のリンクは従来の <code className="bg-gray-100 px-1 rounded">#page=N</code> フラグメントを使用しています。
              iOS Safari / PWA では 1ページ目が表示されます（指定ページに飛びません）。
            </p>
            <a
              href={`${pdfUrl}#page=${pageNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg text-center transition-colors"
            >
              従来方式で開く（{pageNumber}ページ指定）
              <span className="text-xs block text-gray-500 mt-1">
                ※ iOS では 1ページ目が開きます
              </span>
            </a>
          </div>
        )}

        {/* 説明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">テスト方法</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>上の入力欄で表示したいページ番号を指定</li>
            <li>「PDF をフルスクリーンで表示」ボタンをタップ</li>
            <li>指定ページが表示されることを確認</li>
            <li>「従来方式で開く」と比較してみてください</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
