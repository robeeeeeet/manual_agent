"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { compressImageForUpload } from "@/lib/imageCompressor";
import { isHeicFile, convertHeicToJpeg } from "@/lib/heicConverter";
import {
  ContactFormData,
  ContactType,
  ContactScreen,
  CONTACT_TYPE_OPTIONS,
  CONTACT_SCREEN_OPTIONS,
} from "@/types/contact";

export default function ContactPage() {
  const [formData, setFormData] = useState<ContactFormData>({
    type: "",
    screen: "",
    content: "",
    reproductionSteps: "",
  });
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [webhookFailed, setWebhookFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBugReport = formData.type === "bug_report";
  const isFormValid = formData.type && formData.screen && formData.content.trim();

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScreenshot(file);

    // HEIC形式の場合はプレビュー用に変換
    if (isHeicFile(file)) {
      setIsConverting(true);
      setScreenshotPreview(null);

      try {
        const result = await convertHeicToJpeg(file);
        if (result.success && result.dataUrl) {
          setScreenshotPreview(result.dataUrl);
        } else {
          setScreenshotPreview("heic-placeholder");
        }
      } catch (err) {
        console.error("HEIC conversion error:", err);
        setScreenshotPreview("heic-placeholder");
      } finally {
        setIsConverting(false);
      }
    } else {
      // 通常の画像ファイル
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("type", formData.type);
      formDataToSend.append("screen", formData.screen);
      formDataToSend.append("content", formData.content);

      if (isBugReport && formData.reproductionSteps) {
        formDataToSend.append("reproductionSteps", formData.reproductionSteps);
      }

      // スクリーンショットがある場合は圧縮して追加
      if (isBugReport && screenshot) {
        const compressionResult = await compressImageForUpload(screenshot);
        if (compressionResult.success && compressionResult.file) {
          formDataToSend.append("screenshot", compressionResult.file);
        }
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        body: formDataToSend,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "送信に失敗しました");
      }

      // Check if webhook failed (spreadsheet sync)
      if (data.webhook_success === false) {
        setWebhookFailed(true);
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      setError(err instanceof Error ? err.message : "送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 送信完了画面
  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        {/* iOS-style Header */}
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">お問い合わせ</h1>
          </div>
        </header>

        <div className="px-4 pt-8">
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-[#34C759]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">送信完了</h2>
            <p className="text-gray-600 mb-4">
              お問い合わせありがとうございます。<br />
              内容を確認の上、必要に応じてご連絡いたします。
            </p>
            {webhookFailed && (
              <div className="bg-[#FF9500]/10 border border-[#FF9500]/30 rounded-xl p-3 mb-4">
                <p className="text-[#996300] text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>
                    <strong>注意：</strong>スプレッドシートへの連携に失敗しました。
                    スクリーンショットは保存されています。
                    しばらく経っても対応がない場合は、再度お問い合わせください。
                  </span>
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
              <Link href="/" className="w-full">
                <Button variant="primary" className="w-full">トップに戻る</Button>
              </Link>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSubmitted(false);
                  setWebhookFailed(false);
                  setFormData({ type: "", screen: "", content: "", reproductionSteps: "" });
                  setScreenshot(null);
                  setScreenshotPreview(null);
                }}
              >
                別のお問い合わせ
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      {/* iOS-style Header */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">お問い合わせ</h1>
          <p className="text-sm text-gray-500">ご意見・ご要望をお聞かせください</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 pt-4">
        {/* Form Section */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span>📝</span>
            <span>お問い合わせ内容</span>
          </h2>

          <Card>
            <CardBody className="space-y-5">
              {/* 種類 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  種類 <span className="text-[#FF3B30]">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ContactType | "" })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] transition-colors"
                  required
                >
                  <option value="">選択してください</option>
                  {CONTACT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 画面 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  関連する画面 <span className="text-[#FF3B30]">*</span>
                </label>
                <select
                  value={formData.screen}
                  onChange={(e) => setFormData({ ...formData, screen: e.target.value as ContactScreen | "" })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] transition-colors"
                  required
                >
                  <option value="">選択してください</option>
                  {CONTACT_SCREEN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 内容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  内容 <span className="text-[#FF3B30]">*</span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={5}
                  maxLength={5000}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] resize-none transition-colors"
                  placeholder={
                    formData.type === "feature_request"
                      ? "どのような機能があると便利ですか？"
                      : formData.type === "bug_report"
                        ? "どのような問題が発生しましたか？"
                        : "お問い合わせ内容を入力してください"
                  }
                  required
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {formData.content.length} / 5000
                </p>
              </div>

              {/* バグ報告時のみ表示 */}
              {isBugReport && (
                <>
                  {/* 発生手順 */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      発生手順（任意）
                    </label>
                    <textarea
                      value={formData.reproductionSteps}
                      onChange={(e) => setFormData({ ...formData, reproductionSteps: e.target.value })}
                      rows={4}
                      maxLength={5000}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] resize-none transition-colors"
                      placeholder="1. ○○ページを開く&#10;2. ○○ボタンをタップ&#10;3. エラーが表示される"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      問題が発生するまでの操作手順を教えてください
                    </p>
                  </div>

                  {/* スクリーンショット */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      スクリーンショット（任意）
                    </label>

                    {!screenshotPreview ? (
                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotChange}
                          className="hidden"
                          id="screenshot-input"
                        />
                        <label
                          htmlFor="screenshot-input"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#007AFF] hover:bg-[#007AFF]/5 transition-colors"
                        >
                          {isConverting ? (
                            <div className="flex items-center gap-2 text-gray-500">
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span className="text-sm">変換中...</span>
                            </div>
                          ) : (
                            <>
                              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm text-gray-500">タップして画像を選択</span>
                              <span className="text-xs text-gray-400 mt-1">JPEG, PNG, HEIC 対応</span>
                            </>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="relative">
                        {screenshotPreview === "heic-placeholder" ? (
                          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="w-12 h-12 bg-[#007AFF]/10 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{screenshot?.name}</p>
                              <p className="text-xs text-gray-500">HEIC 形式（送信時に変換されます）</p>
                            </div>
                          </div>
                        ) : (
                          <div className="relative rounded-lg overflow-hidden border border-gray-200">
                            <img
                              src={screenshotPreview}
                              alt="スクリーンショット"
                              className="w-full h-48 object-contain bg-gray-50"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleRemoveScreenshot}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-[#FF3B30] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#E5352C] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </section>

        {/* Info Box */}
        <section className="mb-6">
          <div className="bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-xl p-4">
            <h3 className="font-semibold text-[#007AFF] mb-2 flex items-center gap-2">
              <span>💡</span>
              <span>送信前のご確認</span>
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex gap-2">
                <span>•</span>
                <span>バグ報告時は、スクリーンショットを添付していただくと原因特定がスムーズです</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>必要に応じてご登録のメールアドレスに返信いたします</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Error Message */}
        {error && (
          <section className="mb-6">
            <div className="bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-xl p-4">
              <p className="text-[#FF3B30] text-sm flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </p>
            </div>
          </section>
        )}

        {/* Submit Button */}
        <section>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!isFormValid || isSubmitting}
            isLoading={isSubmitting}
          >
            {isSubmitting ? "送信中..." : "送信する"}
          </Button>
        </section>

        {/* Help Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            使い方でお困りですか？{" "}
            <Link href="/help" className="text-[#007AFF] hover:text-[#0066DD] font-medium">
              使い方ガイドを見る
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
