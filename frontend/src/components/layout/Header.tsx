"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import NotificationPermission from "@/components/notification/NotificationPermission";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  // キャッシュをクリアしてページを更新
  const handleClearCacheAndRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Service Workerのキャッシュをクリア
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      // ページをハードリロード
      window.location.reload();
    } catch (error) {
      console.error("Cache clear failed:", error);
      // エラーでも一応リロードする
      window.location.reload();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setIsMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <header className="bg-white/95 backdrop-blur-xl shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
        <nav className="container mx-auto px-4 relative">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <svg
                className="w-7 h-7 text-[#007AFF]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <span className="text-lg font-bold text-gray-900 hidden sm:inline">トリセツコンシェルジュ</span>
              <span className="text-lg font-bold text-gray-900 sm:hidden">トリセツ</span>
            </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/appliances"
              className="text-gray-600 hover:text-[#007AFF] transition-colors"
            >
              家電一覧
            </Link>
            <Link
              href="/maintenance"
              className="text-gray-600 hover:text-[#007AFF] transition-colors"
            >
              メンテナンス
            </Link>
            <Link
              href="/help"
              className="text-gray-600 hover:text-[#007AFF] transition-colors"
              aria-label="ヘルプ"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
            <a
              href="https://forms.gle/ffkRYfvQVJkLG1xWA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-[#007AFF] transition-colors"
              aria-label="お問い合わせ"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </a>
            {!loading && (
              <>
                {user ? (
                  <>
                    <Link
                      href="/groups"
                      className="text-gray-600 hover:text-[#007AFF] transition-colors"
                    >
                      グループ
                    </Link>
                    <Link
                      href="/register"
                      className="bg-[#007AFF] text-white px-4 py-2 rounded-lg hover:bg-[#0066DD] transition-colors"
                    >
                      家電を登録
                    </Link>
                    <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                      <span className="text-sm text-gray-600 truncate max-w-[150px]">
                        {user.email}
                      </span>
                      {/* My Page Link */}
                      <Link
                        href="/mypage"
                        className="p-2 text-gray-600 hover:text-[#007AFF] transition-colors"
                        aria-label="マイページ"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </Link>
                      {/* Notification Bell Icon */}
                      <div className="relative">
                        <button
                          onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                          className="p-2 text-gray-600 hover:text-[#007AFF] transition-colors relative"
                          aria-label="通知設定"
                        >
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                            />
                          </svg>
                        </button>
                        {/* Notification Panel */}
                        {showNotificationPanel && (
                          <>
                            {/* Backdrop */}
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setShowNotificationPanel(false)}
                            />
                            {/* Panel */}
                            <div className="absolute right-0 top-full mt-2 w-80 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4">
                              <NotificationPermission />
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="text-gray-600 hover:text-[#FF3B30] transition-colors text-sm"
                      >
                        ログアウト
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-gray-600 hover:text-[#007AFF] transition-colors"
                    >
                      ログイン
                    </Link>
                    <Link
                      href="/signup"
                      className="bg-[#007AFF] text-white px-4 py-2 rounded-lg hover:bg-[#0066DD] transition-colors"
                    >
                      新規登録
                    </Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="flex items-center gap-1 md:hidden">
            {/* Cache Clear & Refresh Button (Mobile Only) */}
            <button
              onClick={handleClearCacheAndRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-500 hover:text-[#007AFF] active:text-[#0066DD] transition-colors disabled:opacity-50"
              aria-label="キャッシュをクリアして更新"
              title="キャッシュをクリアして更新"
            >
              <svg
                className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Mobile Menu Button */}
            {!isLoginPage && (
              <button
                className="p-2 text-gray-600"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="メニュー"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden absolute left-0 right-0 top-full bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-lg z-50">
            <div className="flex flex-col py-2">
              <Link
                href="/appliances"
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                家電一覧
              </Link>
              <Link
                href="/maintenance"
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                メンテナンス
              </Link>
              <Link
                href="/help"
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                使い方ガイド
              </Link>
              <a
                href="https://forms.gle/ffkRYfvQVJkLG1xWA"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                お問い合わせ
              </a>
              {!loading && (
                <>
                  {user ? (
                    <>
                      <Link
                        href="/groups"
                        className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        グループ
                      </Link>
                      <Link
                        href="/mypage"
                        className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        マイページ
                      </Link>
                      {/* PDF Test Link - 特定ユーザーのみ表示 */}
                      {user.email === "notsuka0217@gmail.com" && (
                        <Link
                          href="/pdf-test"
                          className="px-4 py-3 text-purple-600 hover:bg-purple-50 active:bg-purple-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          🧪 PDF ビューア テスト
                        </Link>
                      )}
                      <button
                        onClick={handleSignOut}
                        className="px-4 py-3 text-left text-[#FF3B30] hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        ログアウト
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="px-4 py-3 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 flex items-center gap-3"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                        ログイン
                      </Link>
                      <div className="px-4 py-3">
                        <Link
                          href="/signup"
                          className="block bg-[#007AFF] text-white px-4 py-3 rounded-xl hover:bg-[#0066DD] transition-colors text-center font-semibold"
                          onClick={() => setIsMenuOpen(false)}
                        >
                          新規登録
                        </Link>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        </nav>
      </header>
    </>
  );
}
