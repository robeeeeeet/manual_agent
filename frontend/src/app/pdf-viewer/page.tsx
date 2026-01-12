"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";

// PDFViewer は DOM API を使用するため、SSR を無効にして動的インポート
const PDFViewer = dynamic(
  () => import("@/components/pdf/PDFViewer").then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="text-gray-400 text-sm">PDF ビューアを読み込み中...</p>
        </div>
      </div>
    ),
  }
);

function PDFViewerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const applianceId = searchParams.get("applianceId");
  const pageParam = searchParams.get("page");
  const initialPage = pageParam ? parseInt(pageParam, 10) : 1;

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applianceName, setApplianceName] = useState<string>("");

  // PDF読み込みエラー時のフォールバックモーダル
  const [showFallbackModal, setShowFallbackModal] = useState(false);

  // Fetch signed URL for the appliance's PDF
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError("ログインが必要です");
      return;
    }
    if (!applianceId) {
      setLoading(false);
      setError("家電IDが指定されていません");
      return;
    }

    const fetchPdfUrl = async () => {
      try {
        // Fetch appliance info first
        const applianceResponse = await fetch(`/api/appliances/${applianceId}`);
        if (!applianceResponse.ok) {
          if (applianceResponse.status === 404) {
            throw new Error("この家電は見つかりませんでした");
          }
          throw new Error("家電データの取得に失敗しました");
        }
        const applianceData = await applianceResponse.json();
        setApplianceName(applianceData.name || "");

        if (!applianceData.stored_pdf_path) {
          throw new Error("この家電には説明書PDFが登録されていません");
        }

        // Fetch signed URL
        const pdfUrlResponse = await fetch(`/api/appliances/${applianceId}/manual-url`);
        if (!pdfUrlResponse.ok) {
          throw new Error("PDFのURLを取得できませんでした");
        }
        const pdfData = await pdfUrlResponse.json();
        if (!pdfData.signed_url) {
          throw new Error("PDFのURLが見つかりませんでした");
        }
        setPdfUrl(pdfData.signed_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();
  }, [authLoading, user, applianceId]);

  // Handle close - go back or to appliance detail
  const handleClose = useCallback(() => {
    if (applianceId) {
      router.push(`/appliances/${applianceId}`);
    } else {
      router.push("/appliances");
    }
  }, [router, applianceId]);

  // Handle PDF load error - show fallback modal
  const handlePdfLoadError = useCallback(() => {
    setShowFallbackModal(true);
  }, []);

  // Open PDF in external browser
  const handleOpenInBrowser = useCallback(() => {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    }
    // モーダルを閉じて家電詳細に戻る
    setShowFallbackModal(false);
    handleClose();
  }, [pdfUrl, handleClose]);

  // Cancel - go back to appliance detail
  const handleCancelFallback = useCallback(() => {
    setShowFallbackModal(false);
    handleClose();
  }, [handleClose]);

  // Authentication loading
  if (authLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="text-gray-400 text-sm">認証を確認中...</p>
        </div>
      </div>
    );
  }

  // Loading PDF URL
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          <p className="text-gray-400 text-sm">
            {applianceName ? `${applianceName} の説明書を読み込み中...` : "説明書を読み込み中..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state (before PDF viewer loads)
  if (error || !pdfUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">エラーが発生しました</h2>
          <p className="text-gray-400 text-sm mb-6">{error || "PDFを表示できませんでした"}</p>
          <button
            onClick={handleClose}
            className="px-6 py-2.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  // Show PDF Viewer with fallback modal
  return (
    <>
      <PDFViewer
        url={pdfUrl}
        initialPage={initialPage}
        fullScreen={true}
        onClose={handleClose}
        onLoadError={handlePdfLoadError}
      />

      {/* PDF読み込みエラー時のフォールバックモーダル */}
      <Modal
        isOpen={showFallbackModal}
        onClose={handleCancelFallback}
        variant="dialog"
      >
        <div className="p-6">
          <div className="w-14 h-14 bg-[#FF9500]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-gray-900 text-center mb-3">
            PDFを表示できません
          </h3>

          <p className="text-gray-600 text-sm text-center mb-6">
            このPDFは保護されているため、アプリ内で表示できません。
            <br />
            ブラウザで開きますか？
            <br />
            <span className="text-gray-400 text-xs">
              ※ ページ指定での表示はできません
            </span>
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleCancelFallback}
              className="flex-1 py-2.5 text-[#007AFF] font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              いいえ
            </button>
            <button
              onClick={handleOpenInBrowser}
              className="flex-1 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors"
            >
              はい
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function PDFViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 bg-gray-900 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="text-gray-400 text-sm">読み込み中...</p>
          </div>
        </div>
      }
    >
      <PDFViewerContent />
    </Suspense>
  );
}
