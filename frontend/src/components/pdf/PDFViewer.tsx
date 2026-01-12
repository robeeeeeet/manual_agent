"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// PDF.js worker の設定（CDN から読み込み）
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Document options（コンポーネント外で定義して不要な再レンダリングを防止）
// - cMapUrl/cMapPacked: CJK（日本語等）フォントサポート
// - wasmUrl: JPEG 2000 (JPX) 画像サポート用のWebAssembly
const documentOptions = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/wasm/`,
};

interface PDFViewerProps {
  /** PDF の URL（署名付きURL等） */
  url: string;
  /** 初期表示ページ番号（1始まり） */
  initialPage?: number;
  /** フルスクリーン表示（デフォルト: false） */
  fullScreen?: boolean;
  /** 閉じるボタンのコールバック（フルスクリーン時） */
  onClose?: () => void;
  /** PDFロードエラー時のコールバック */
  onLoadError?: (error: Error) => void;
  /** クラス名 */
  className?: string;
}

// タッチジェスチャー用の型定義
interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  initialPinchDistance: number | null;
  initialScale: number;
  // ピンチ中心点（コンテンツ座標系）
  pinchCenterX: number;
  pinchCenterY: number;
  // ピンチ開始時のスクロール位置
  initialScrollLeft: number;
  initialScrollTop: number;
}

export function PDFViewer({
  url,
  initialPage = 1,
  fullScreen = false,
  onClose,
  onLoadError,
  className = "",
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [visualScale, setVisualScale] = useState(1.0); // CSSトランスフォーム用（ピンチ中のスムーズ表示）
  const [isPinching, setIsPinching] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center"); // ピンチ中心点
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<TouchState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    initialPinchDistance: null,
    initialScale: 1.0,
    pinchCenterX: 0,
    pinchCenterY: 0,
    initialScrollLeft: 0,
    initialScrollTop: 0,
  });

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
    // 外部にエラーを通知
    onLoadError?.(error);
  }, [onLoadError]);

  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev));
  }, [numPages]);

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  // 2点間の距離を計算（ピンチズーム用）
  const getDistance = useCallback((touches: TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // タッチジェスチャーの状態を保持するref（useEffect内で最新値を参照するため）
  const scaleRef = useRef(scale);
  const visualScaleRef = useRef(visualScale);
  const numPagesRef = useRef(numPages);
  const pageNumberRef = useRef(pageNumber);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    visualScaleRef.current = visualScale;
  }, [visualScale]);

  useEffect(() => {
    numPagesRef.current = numPages;
  }, [numPages]);

  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  // ネイティブタッチイベントリスナー（passive: false でブラウザズームを防止）
  useEffect(() => {
    if (!fullScreen || !pdfAreaRef.current) return;

    const element = pdfAreaRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touches = e.touches;
      const state = touchStateRef.current;

      if (touches.length === 1) {
        // シングルタッチ：スワイプ/タップ用
        state.startX = touches[0].clientX;
        state.startY = touches[0].clientY;
        state.startTime = Date.now();
        state.initialPinchDistance = null;
      } else if (touches.length === 2) {
        // ダブルタッチ：ピンチズーム用 - ブラウザのズームを防止
        e.preventDefault();
        state.initialPinchDistance = getDistance(touches);
        state.initialScale = scaleRef.current;

        // ピンチ中心点を計算（画面座標）
        const centerX = (touches[0].clientX + touches[1].clientX) / 2;
        const centerY = (touches[0].clientY + touches[1].clientY) / 2;

        // スクロールコンテナの情報を取得
        const rect = element.getBoundingClientRect();

        // コンテンツ座標系に変換（スクロール位置を考慮）
        state.pinchCenterX = centerX - rect.left + element.scrollLeft;
        state.pinchCenterY = centerY - rect.top + element.scrollTop;
        state.initialScrollLeft = element.scrollLeft;
        state.initialScrollTop = element.scrollTop;

        // transform-origin を設定
        setTransformOrigin(`${state.pinchCenterX}px ${state.pinchCenterY}px`);
        setIsPinching(true);
        setVisualScale(1.0); // リセット
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touches = e.touches;
      const state = touchStateRef.current;

      if (touches.length === 2 && state.initialPinchDistance !== null) {
        // ピンチズーム - ブラウザのズームを防止
        e.preventDefault();
        const currentDistance = getDistance(touches);
        const scaleChange = currentDistance / state.initialPinchDistance;
        // CSSトランスフォームのみ更新（スムーズな表示）
        setVisualScale(scaleChange);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const state = touchStateRef.current;

      // ピンチ中だった場合は最終スケールを確定
      if (state.initialPinchDistance !== null) {
        const finalVisualScale = visualScaleRef.current;
        const finalScale = Math.min(Math.max(state.initialScale * finalVisualScale, 0.5), 3.0);
        const scaleRatio = finalScale / state.initialScale;

        // ピンチ中心点を基準にスクロール位置を調整
        // 新しいスケールでの中心点位置を計算
        const newScrollLeft = state.pinchCenterX * scaleRatio - (state.pinchCenterX - state.initialScrollLeft);
        const newScrollTop = state.pinchCenterY * scaleRatio - (state.pinchCenterY - state.initialScrollTop);

        setScale(finalScale);
        setVisualScale(1.0); // リセット
        setIsPinching(false);
        state.initialPinchDistance = null;

        // スクロール位置を調整（次のレンダリング後に適用）
        requestAnimationFrame(() => {
          if (pdfAreaRef.current) {
            pdfAreaRef.current.scrollLeft = Math.max(0, newScrollLeft);
            pdfAreaRef.current.scrollTop = Math.max(0, newScrollTop);
          }
        });
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const deltaTime = Date.now() - state.startTime;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // 倍率100%以下の場合のみスワイプでページ送り
      // 101%以上の場合はスクロール（パン）を優先
      if (scaleRef.current <= 1.0) {
        // スワイプ判定（水平方向に50px以上、300ms以内、縦より横の移動が大きい）
        if (absDeltaX > 50 && deltaTime < 300 && absDeltaX > absDeltaY) {
          if (deltaX > 0) {
            // 右スワイプ → 前のページ
            setPageNumber((prev) => Math.max(prev - 1, 1));
          } else {
            // 左スワイプ → 次のページ
            setPageNumber((prev) => Math.min(prev + 1, numPagesRef.current || prev));
          }
          return;
        }
      }

      // タップ判定（移動距離10px以内、300ms以内）- 倍率に関係なく有効
      if (absDeltaX < 10 && absDeltaY < 10 && deltaTime < 300) {
        const rect = pdfAreaRef.current?.getBoundingClientRect();
        if (!rect) return;

        const tapX = touch.clientX - rect.left;
        const tapZoneWidth = rect.width / 3;

        // 左1/3タップ → 前のページ、右1/3タップ → 次のページ
        if (tapX < tapZoneWidth) {
          setPageNumber((prev) => Math.max(prev - 1, 1));
        } else if (tapX > rect.width - tapZoneWidth) {
          setPageNumber((prev) => Math.min(prev + 1, numPagesRef.current || prev));
        }
        // 中央1/3タップは何もしない（将来的にUIトグル等に使用可能）
      }
    };

    // passive: false でイベントリスナーを登録（e.preventDefault()を有効にするため）
    element.addEventListener("touchstart", handleTouchStart, { passive: false });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
    };
  }, [fullScreen, getDistance]);

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
        ref={pdfAreaRef}
        className={`flex-1 overflow-auto ${
          fullScreen
            ? `bg-gray-800 ${scale <= 1.0 ? "touch-none" : "touch-pan-x touch-pan-y"}`
            : "border border-gray-200 rounded-b-lg bg-gray-50"
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

        <div
          ref={pdfContentRef}
          className="transition-transform"
          style={{
            transform: isPinching ? `scale(${visualScale})` : "scale(1)",
            transformOrigin: isPinching ? transformOrigin : "top left",
            transition: isPinching ? "none" : "transform 0.1s ease-out",
          }}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
            error={null}
            className={`py-4 ${scale > 1.0 ? "" : "flex justify-center"}`}
            options={documentOptions}
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
