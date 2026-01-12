"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useAppliances } from "@/hooks/useAppliances";

export default function AppliancesPage() {
  const { user, loading: authLoading } = useAuth();
  const { appliances, isLoading, error, refetch } = useAppliances();

  // Get maintenance badge styling based on days until due
  const getMaintenanceBadge = (daysUntilDue: number) => {
    if (daysUntilDue < 0) {
      return {
        bg: "bg-[#FF3B30]/10",
        text: "text-[#FF3B30]",
        label: `${Math.abs(daysUntilDue)}日超過`,
      };
    } else if (daysUntilDue === 0) {
      return {
        bg: "bg-[#FF9500]/10",
        text: "text-[#FF9500]",
        label: "今日",
      };
    } else if (daysUntilDue <= 7) {
      return {
        bg: "bg-[#FF9500]/10",
        text: "text-[#FF9500]",
        label: `${daysUntilDue}日後`,
      };
    } else {
      return {
        bg: "bg-[#34C759]/10",
        text: "text-[#34C759]",
        label: `${daysUntilDue}日後`,
      };
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">家電</h1>
          </div>
        </header>
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">家電</h1>
          </div>
        </header>
        <div className="px-4 pt-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">ログインが必要です</h2>
            <p className="text-gray-500 text-sm mb-6">
              登録した家電を表示するにはログインしてください
            </p>
            <Link href="/login">
              <button className="px-6 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                ログイン
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      {/* iOS-style Header */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">家電</h1>
            {!isLoading && (
              <p className="text-sm text-gray-500">{appliances.length}件登録</p>
            )}
          </div>
          <Link href="/register">
            <button className="w-10 h-10 bg-[#007AFF] text-white rounded-full flex items-center justify-center hover:bg-[#0066DD] transition-colors shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </Link>
        </div>
      </header>

      <div className="px-4 pt-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="w-16 h-16 bg-[#FF3B30]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#FF3B30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium mb-2">エラーが発生しました</p>
            <p className="text-gray-500 text-sm mb-4">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="px-6 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors"
            >
              再読み込み
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && appliances.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-20 h-20 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              まだ家電が登録されていません
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              写真を撮るだけでAIが自動認識します
            </p>
            <Link href="/register">
              <button className="px-6 py-3 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                最初の家電を登録する
              </button>
            </Link>
          </div>
        )}

        {/* Appliance List - iOS Style */}
        {!isLoading && !error && appliances.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {appliances.map((appliance) => (
              <Link key={appliance.id} href={`/appliances/${appliance.id}`}>
                <div className="flex items-center p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {appliance.name}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                        {appliance.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mb-1">
                      {appliance.maker} {appliance.model_number}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Maintenance Badge */}
                      {appliance.next_maintenance && (
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                          getMaintenanceBadge(appliance.next_maintenance.days_until_due).bg
                        } ${
                          getMaintenanceBadge(appliance.next_maintenance.days_until_due).text
                        }`}>
                          次回: {getMaintenanceBadge(appliance.next_maintenance.days_until_due).label}
                        </span>
                      )}

                      {/* Owner Display Name */}
                      {appliance.owner_display_name && (
                        <span className="text-xs text-gray-400">
                          登録: {appliance.owner_display_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <svg className="w-5 h-5 text-gray-300 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
