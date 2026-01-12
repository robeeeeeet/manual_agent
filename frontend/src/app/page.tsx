"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import MaintenanceListItem from "@/components/maintenance/MaintenanceListItem";
import MaintenanceCompleteModal from "@/components/maintenance/MaintenanceCompleteModal";
import { useAppliances } from "@/hooks/useAppliances";
import { useMaintenance } from "@/hooks/useMaintenance";
import {
  MaintenanceWithAppliance,
  MaintenanceSchedule,
} from "@/types/appliance";

// ハイブリッドデザイン: B案の色味 + C案の形状
// iOS Blue カラー、Material風の丸いアイコン、3列クイックアクション

export default function Home() {
  const { user, loading: authLoading } = useAuth();

  // SWR hooks for data fetching
  const { appliances: allAppliances, isLoading: appliancesLoading } = useAppliances();
  const { items: urgentMaintenance, isLoading: maintenanceLoading, refetch: refetchMaintenance } = useMaintenance("overdue,upcoming");

  // Limit appliances to 4 for home page
  const appliances = allAppliances.slice(0, 4);
  // Limit urgent maintenance to 5 for home page
  const limitedUrgentMaintenance = urgentMaintenance.slice(0, 5);

  // Complete modal state
  const [selectedItem, setSelectedItem] =
    useState<MaintenanceWithAppliance | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Handle completion modal
  const openCompleteModal = (item: MaintenanceWithAppliance) => {
    setSelectedItem(item);
    setShowCompleteModal(true);
  };

  const handleCompleteSuccess = () => {
    setShowCompleteModal(false);
    setSelectedItem(null);
    refetchMaintenance();
  };

  // Convert MaintenanceWithAppliance to MaintenanceSchedule for modal
  const selectedSchedule: MaintenanceSchedule | null = selectedItem
    ? {
        id: selectedItem.id,
        user_appliance_id: selectedItem.appliance_id,
        shared_item_id: null,
        task_name: selectedItem.task_name,
        description: selectedItem.description,
        interval_type: selectedItem.interval_type,
        interval_value: selectedItem.interval_value,
        last_done_at: selectedItem.last_done_at,
        next_due_at: selectedItem.next_due_at,
        source_page: selectedItem.source_page,
        importance: selectedItem.importance,
        created_at: "",
        updated_at: "",
      }
    : null;

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24">
      {/* iOS-style Header - Simple */}
      <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            ホーム
          </h1>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-6">
        {/* Not logged in state */}
        {!authLoading && !user && (
          <>
            {/* Welcome Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-center">
                <div className="w-20 h-20 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  トリセツコンシェルジュ
                </h2>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  AIが取説検索・メンテ管理・<br />疑問解決を全自動でサポート
                </p>
                <div className="space-y-3">
                  <Link href="/signup" className="block">
                    <button className="w-full py-3 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                      無料で始める
                    </button>
                  </Link>
                  <Link href="/login" className="block">
                    <button className="w-full py-3 text-[#007AFF] font-semibold rounded-xl hover:bg-gray-100 transition-colors">
                      サインイン
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Features - iOS List Style */}
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide px-1 mb-2">
                主な機能
              </h2>
              <div className="bg-white rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
                <div className="flex items-center p-4">
                  <div className="w-11 h-11 bg-[#007AFF] rounded-full flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">AI画像認識</h3>
                    <p className="text-sm text-gray-500">写真からメーカー・型番を自動認識</p>
                  </div>
                </div>
                <div className="flex items-center p-4">
                  <div className="w-11 h-11 bg-[#34C759] rounded-full flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">説明書自動取得</h3>
                    <p className="text-sm text-gray-500">公式PDFを自動で検索・保存</p>
                  </div>
                </div>
                <div className="flex items-center p-4">
                  <div className="w-11 h-11 bg-[#FF9500] rounded-full flex items-center justify-center mr-4">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">リマインド通知</h3>
                    <p className="text-sm text-gray-500">メンテナンス時期をお知らせ</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Logged in state */}
        {user && (
          <>
            {/* Quick Actions - 3 Column with Round Icons (C案スタイル + B案カラー) */}
            <div className="flex gap-3">
              <Link href="/register" className="flex-1">
                <div className="bg-[#007AFF]/10 rounded-2xl p-4 hover:bg-[#007AFF]/20 transition-colors h-full text-center">
                  <div className="w-12 h-12 bg-[#007AFF] rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h3 className="text-gray-900 font-medium text-sm">家電を追加</h3>
                </div>
              </Link>
              <Link href="/maintenance" className="flex-1">
                <div className="bg-[#FF9500]/10 rounded-2xl p-4 hover:bg-[#FF9500]/20 transition-colors h-full text-center">
                  <div className="w-12 h-12 bg-[#FF9500] rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-gray-900 font-medium text-sm">メンテナンス</h3>
                </div>
              </Link>
              <Link href="/appliances" className="flex-1">
                <div className="bg-[#34C759]/10 rounded-2xl p-4 hover:bg-[#34C759]/20 transition-colors h-full text-center">
                  <div className="w-12 h-12 bg-[#34C759] rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </div>
                  <h3 className="text-gray-900 font-medium text-sm">家電一覧</h3>
                </div>
              </Link>
            </div>

            {/* Urgent Maintenance - iOS List Style */}
            {!maintenanceLoading && limitedUrgentMaintenance.length > 0 && (
              <div>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    やることリスト
                  </h2>
                  <Link href="/maintenance" className="text-[#007AFF] text-sm font-medium">
                    すべて表示
                  </Link>
                </div>
                <div className="bg-white rounded-xl overflow-hidden shadow-sm">
                  <div className="divide-y divide-gray-100">
                    {limitedUrgentMaintenance.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                        <MaintenanceListItem
                          item={item}
                          onComplete={openCompleteModal}
                          showApplianceName={true}
                          compact={true}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* All Done Message */}
            {!maintenanceLoading && limitedUrgentMaintenance.length === 0 && appliances.length > 0 && (
              <div className="bg-[#34C759]/10 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-[#34C759] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-gray-900 font-semibold">すべて完了</h3>
                <p className="text-gray-600 text-sm mt-1">今やるべきタスクはありません</p>
              </div>
            )}

            {/* Appliances - iOS List Style (B案) */}
            <div>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  マイ家電
                </h2>
                {appliances.length > 0 && (
                  <Link href="/appliances" className="text-[#007AFF] text-sm font-medium">
                    すべて表示
                  </Link>
                )}
              </div>

              {/* Loading State */}
              {(authLoading || appliancesLoading) && (
                <div className="bg-white rounded-xl p-8 shadow-sm">
                  <div className="flex justify-center">
                    <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!authLoading && !appliancesLoading && appliances.length === 0 && (
                <div className="bg-white rounded-xl p-8 shadow-sm text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">家電を登録しましょう</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    写真を撮るだけでAIが自動認識
                  </p>
                  <Link href="/register">
                    <button className="px-6 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                      家電を追加
                    </button>
                  </Link>
                </div>
              )}

              {/* Appliance List - iOS Style (B案) */}
              {!authLoading && !appliancesLoading && appliances.length > 0 && (
                <div className="bg-white rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
                  {appliances.map((appliance) => (
                    <Link key={appliance.id} href={`/appliances/${appliance.id}`}>
                      <div className="flex items-center p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                        <div className="w-12 h-12 bg-[#007AFF]/10 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                          <svg className="w-6 h-6 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {appliance.name}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            {appliance.maker}
                          </p>
                        </div>
                        <svg className="w-5 h-5 text-gray-300 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Complete Modal */}
      <MaintenanceCompleteModal
        isOpen={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false);
          setSelectedItem(null);
        }}
        schedule={selectedSchedule}
        applianceName={selectedItem?.appliance_name}
        onComplete={handleCompleteSuccess}
      />
    </div>
  );
}
