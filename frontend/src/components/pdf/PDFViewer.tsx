"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// PDF.js worker の設定（CDN から読み込み）
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  /** PDF の URL（署名付きURL等） */
  url: string;
  /** 初期表示ページ番号（1始まり） */
  initialPage?: number;
  /** フルスクリーン表示（デフォルト: false） */
  fullScreen?: boolean;
  /** 閉じるボタンのコールバック（フルスクリーン時） */
  onClose?: () => void;
  /** クラス名 */
  className?: string;
}

export function PDFViewer({
  url,
  initialPage = 1,
  fullScreen = false,
  onClose,
  className = "",
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // コンテナ幅を監視
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - 32); // padding分を引く
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setLoading(false);
      // 初期ページが範囲外なら調整
      if (initialPage > numPages) {
        setPageNumber(numPages);
      } else if (initialPage < 1) {
        setPageNumber(1);
      }
    },
    [initialPage]
  );

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`PDFの読み込みに失敗しました: ${error.message}`);
    setLoading(false);
  }, []);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  // フルスクリーン時のコンテナスタイル
  const containerClass = fullScreen
    ? "fixed inset-0 z-50 bg-gray-900 flex flex-col"
    : `flex flex-col ${className}`;

  return (
    <div className={containerClass} ref={containerRef}>
      {/* コントロールバー */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${
          fullScreen
            ? "bg-gray-800 text-white"
            : "bg-gray-100 rounded-t-lg border border-b-0 border-gray-200"
        }`}
      >
        {/* 閉じるボタン（フルスクリーン時） */}
        {fullScreen && onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-700 mr-2"
            aria-label="閉じる"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* ページナビゲーション */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className={`p-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed ${
              fullScreen ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
            aria-label="前のページ"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span
            className={`text-sm min-w-[70px] text-center ${
              fullScreen ? "text-gray-200" : "text-gray-700"
            }`}
          >
            {pageNumber} / {numPages || "-"}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className={`p-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed ${
              fullScreen ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
            aria-label="次のページ"
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* ズームコントロール */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className={`p-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed ${
              fullScreen ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
            aria-label="縮小"
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
                d="M20 12H4"
              />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className={`text-xs px-2 py-1 rounded ${
              fullScreen
                ? "text-gray-200 hover:bg-gray-700"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 3.0}
            className={`p-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed ${
              fullScreen ? "hover:bg-gray-700" : "hover:bg-gray-200"
            }`}
            aria-label="拡大"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* PDF 表示エリア */}
      <div
        className={`flex-1 overflow-auto ${
          fullScreen ? "bg-gray-800" : "border border-gray-200 rounded-b-lg bg-gray-50"
        }`}
      >
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-2">
              <svg
                className={`animate-spin h-8 w-8 ${
                  fullScreen ? "text-blue-400" : "text-blue-500"
                }`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span
                className={`text-sm ${
                  fullScreen ? "text-gray-400" : "text-gray-500"
                }`}
              >
                PDF を読み込み中...
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-red-500">
              <svg
                className="w-12 h-12 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p>{error}</p>
            </div>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          error={null}
          className="flex justify-center py-4"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            width={containerWidth > 0 ? containerWidth : undefined}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* 注釈（非フルスクリーン時のみ） */}
      {!fullScreen && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          ※ iOS Safari / PWA でも指定ページを直接表示できます
        </p>
      )}
    </div>
  );
}
