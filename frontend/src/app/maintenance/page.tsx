"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import MaintenanceStatusTabs, {
  type TabStatus,
} from "@/components/maintenance/MaintenanceStatusTabs";
import MaintenanceFilter from "@/components/maintenance/MaintenanceFilter";
import MaintenanceListItem from "@/components/maintenance/MaintenanceListItem";
import MaintenanceCompleteModal from "@/components/maintenance/MaintenanceCompleteModal";
import { SafeHtml } from "@/components/ui/SafeHtml";
import { useMaintenance } from "@/hooks/useMaintenance";
import type {
  MaintenanceWithAppliance,
  MaintenanceSchedule,
  MaintenanceLog,
} from "@/types/appliance";


const importanceConfig = {
  high: { label: "高", bg: "bg-[#FF3B30]/10", text: "text-[#FF3B30]" },
  medium: { label: "中", bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" },
  low: { label: "低", bg: "bg-[#34C759]/10", text: "text-[#34C759]" },
};

export default function MaintenancePage() {
  const { user, loading: authLoading } = useAuth();
  const { items: allItems, counts, isLoading, error, refetch } = useMaintenance();

  // Filter state
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [importanceFilter, setImportanceFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [makerFilter, setMakerFilter] = useState<string | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] = useState<MaintenanceWithAppliance | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<MaintenanceLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Next due date edit modal state
  const [showNextDueModal, setShowNextDueModal] = useState(false);
  const [editingNextDueAt, setEditingNextDueAt] = useState("");
  const [isSavingNextDue, setIsSavingNextDue] = useState(false);

  // Extract unique makers for filter
  const makers = useMemo<string[]>(() => {
    const uniqueMakers = new Set<string>();
    allItems.forEach((item) => {
      if (item.maker) {
        uniqueMakers.add(item.maker);
      }
    });
    return Array.from(uniqueMakers).sort();
  }, [allItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (activeTab !== "all" && item.status !== activeTab) return false;
      if (importanceFilter !== "all" && item.importance !== importanceFilter) return false;
      if (makerFilter && item.maker !== makerFilter) return false;
      return true;
    });
  }, [allItems, activeTab, importanceFilter, makerFilter]);

  const openDetailModal = (item: MaintenanceWithAppliance) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const openCompleteModal = (item: MaintenanceWithAppliance) => {
    setSelectedItem(item);
    setShowCompleteModal(true);
  };

  const handleCompleteSuccess = () => {
    setShowCompleteModal(false);
    setSelectedItem(null);
    window.location.reload();
  };

  // Open next due date modal
  const openNextDueModal = () => {
    if (!selectedItem) return;
    const nextDueDate = selectedItem.next_due_at
      ? selectedItem.next_due_at.split("T")[0]
      : "";
    setEditingNextDueAt(nextDueDate);
    setShowNextDueModal(true);
  };

  // Save next due date
  const handleSaveNextDue = async () => {
    if (!selectedItem) return;

    setIsSavingNextDue(true);
    try {
      const response = await fetch(
        `/api/maintenance/${selectedItem.id}/next-due`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            next_due_at: editingNextDueAt || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("次回予定日の保存に失敗しました");
      }

      // Refresh data
      refetch();

      // Update selected item
      setSelectedItem({
        ...selectedItem,
        next_due_at: editingNextDueAt ? `${editingNextDueAt}T00:00:00Z` : null,
      });

      setShowNextDueModal(false);
    } catch (err) {
      console.error("Save next due date error:", err);
    } finally {
      setIsSavingNextDue(false);
    }
  };

  const fetchHistory = async (scheduleId: string) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/appliances/maintenance-schedules/${scheduleId}/logs`);
      if (!response.ok) throw new Error("履歴の取得に失敗しました");
      const data = await response.json();
      setHistoryLogs(Array.isArray(data) ? data : data.logs || []);
      setShowHistoryModal(true);
    } catch (err) {
      console.error("Fetch history error:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "未設定";
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusText = (daysUntilDue: number | null, status: string): string => {
    if (status === "manual") return "手動";
    if (daysUntilDue === null) return "未設定";
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}日超過`;
    if (daysUntilDue === 0) return "今日";
    if (daysUntilDue === 1) return "明日";
    return `あと${daysUntilDue}日`;
  };

  const getStatusStyle = (daysUntilDue: number | null, status: string) => {
    if (status === "manual") return { bg: "bg-gray-100", text: "text-gray-600" };
    if (daysUntilDue === null) return { bg: "bg-gray-100", text: "text-gray-600" };
    if (daysUntilDue < 0) return { bg: "bg-[#FF3B30]/10", text: "text-[#FF3B30]" };
    if (daysUntilDue <= 7) return { bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" };
    return { bg: "bg-[#34C759]/10", text: "text-[#34C759]" };
  };


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
        pdf_page_number: selectedItem.pdf_page_number,
        printed_page_number: selectedItem.printed_page_number,
        source_page: selectedItem.source_page,
        importance: selectedItem.importance,
        created_at: "",
        updated_at: "",
      }
    : null;

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">メンテナンス</h1>
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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">メンテナンス</h1>
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
            <p className="text-gray-500 text-sm mb-6">メンテナンス一覧を表示するにはログインしてください</p>
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

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">メンテナンス</h1>
          </div>
        </header>
        <div className="px-4 pt-8">
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
        </div>
      </div>
    );
  }

  // Empty state
  if (allItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">メンテナンス</h1>
          </div>
        </header>
        <div className="px-4 pt-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-20 h-20 bg-[#FF9500]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-[#FF9500]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">メンテナンス項目がありません</h2>
            <p className="text-gray-500 text-sm mb-6">家電を登録してメンテナンス項目を追加しましょう</p>
            <Link href="/register">
              <button className="px-6 py-3 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                家電を登録する
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
        <div className="px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">メンテナンス</h1>
        </div>
        {/* Status Tabs */}
        <div className="px-4 pb-3">
          <MaintenanceStatusTabs
            activeTab={activeTab}
            counts={counts}
            onTabChange={setActiveTab}
          />
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Filters */}
        <MaintenanceFilter
          importance={importanceFilter}
          maker={makerFilter}
          makers={makers}
          onImportanceChange={setImportanceFilter}
          onMakerChange={setMakerFilter}
        />

        {/* Results count */}
        <p className="text-sm text-gray-500 px-1">
          {filteredItems.length}件のメンテナンス項目
        </p>

        {/* Items list */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <p className="text-gray-500">該当するメンテナンス項目がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <MaintenanceListItem
                key={item.id}
                item={item}
                onComplete={openCompleteModal}
                onItemClick={openDetailModal}
                showApplianceName={true}
              />
            ))}
          </div>
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

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedItem(null);
        }}
        variant="dialog"
      >
        <div className="p-6 max-h-[calc(100vh-96px)] flex flex-col">
          {/* Close button */}
          <button
            onClick={() => {
              setShowDetailModal(false);
              setSelectedItem(null);
            }}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {selectedItem && (
            <>
              {/* Fixed Header */}
              <h3 className="text-lg font-bold text-gray-900 mb-4 pr-8 flex-shrink-0">
                {selectedItem.task_name}
              </h3>

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 min-h-0">
                {selectedItem.description && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">説明</h4>
                    <SafeHtml html={selectedItem.description} className="text-gray-700" />
                  </div>
                )}

                <div className="mb-4 p-3 bg-[#F2F2F7] rounded-xl">
                  <h4 className="text-xs font-medium text-gray-500 mb-1">{selectedItem.category || "家電"}</h4>
                  <p className="text-sm text-gray-900">{selectedItem.appliance_name}</p>
                  <p className="text-xs text-gray-500">{selectedItem.maker} {selectedItem.model_number}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 py-4 border-y border-gray-100">
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">周期</h4>
                    <p className="text-sm text-gray-900 whitespace-nowrap">
                      {selectedItem.interval_type === "days"
                        ? `${selectedItem.interval_value}日ごと`
                        : selectedItem.interval_type === "months"
                          ? `${selectedItem.interval_value}ヶ月ごと`
                          : "手動"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">重要度</h4>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${importanceConfig[selectedItem.importance].bg} ${importanceConfig[selectedItem.importance].text}`}>
                      {importanceConfig[selectedItem.importance].label}
                    </span>
                  </div>
                  {(selectedItem.pdf_page_number || selectedItem.printed_page_number || selectedItem.source_page) && (
                    <div className="col-span-2 sm:col-span-1 pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <h4 className="text-xs font-medium text-gray-500 mb-1">参照ページ</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:flex-col sm:items-start sm:gap-1">
                        {selectedItem.pdf_page_number && selectedItem.stored_pdf_path && (
                          <Link
                            href={`/pdf-viewer?applianceId=${selectedItem.appliance_id}&page=${selectedItem.pdf_page_number}`}
                            className="text-sm text-[#007AFF] hover:text-[#0066DD] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>PDF {selectedItem.pdf_page_number}ページ</span>
                            <svg
                              className="w-3.5 h-3.5 flex-shrink-0"
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
                          </Link>
                        )}
                        {(selectedItem.printed_page_number || selectedItem.source_page) && (
                          <p className="text-sm text-gray-600 whitespace-nowrap">
                            説明書 {selectedItem.printed_page_number || selectedItem.source_page}ページ
                          </p>
                        )}
                        {selectedItem.pdf_page_number && !selectedItem.stored_pdf_path && !selectedItem.printed_page_number && (
                          <p className="text-sm text-gray-900 whitespace-nowrap">
                            PDF {selectedItem.pdf_page_number}ページ
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">次回予定日</span>
                      <button
                        onClick={openNextDueModal}
                        className="p-1 text-[#007AFF] hover:bg-[#007AFF]/10 rounded transition-colors"
                        aria-label="次回予定日を編集"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{formatDate(selectedItem.next_due_at)}</span>
                      <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyle(selectedItem.days_until_due, selectedItem.status).bg} ${getStatusStyle(selectedItem.days_until_due, selectedItem.status).text}`}>
                        {getStatusText(selectedItem.days_until_due, selectedItem.status)}
                      </span>
                    </div>
                  </div>
                  {selectedItem.last_done_at && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">前回実施日</span>
                      <span className="text-sm text-gray-900">{formatDate(selectedItem.last_done_at)}</span>
                    </div>
                  )}
                </div>

                {/* History link */}
                <button
                  onClick={() => fetchHistory(selectedItem.id)}
                  disabled={isLoadingHistory}
                  className="text-sm text-[#007AFF] hover:text-[#0066DD] mb-6 disabled:opacity-50"
                >
                  完了履歴を表示
                </button>

                {/* Action buttons */}
                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      openCompleteModal(selectedItem);
                    }}
                    className="w-full py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors"
                  >
                    完了する
                  </button>
                </div>

                <div className="mt-4 text-center">
                  <Link
                    href={`/appliances/${selectedItem.appliance_id}?from=maintenance`}
                    className="text-sm text-[#007AFF] hover:underline"
                  >
                    家電詳細ページへ →
                  </Link>
                </div>
              </div>{/* End Scrollable Content */}
            </>
          )}
        </div>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => {
          setShowHistoryModal(false);
          setHistoryLogs([]);
        }}
        variant="dialog"
      >
        <div className="p-6">
          <button
            onClick={() => {
              setShowHistoryModal(false);
              setHistoryLogs([]);
            }}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h3 className="text-lg font-bold text-gray-900 mb-4 pr-8">メンテナンス履歴</h3>
          {selectedItem && (
            <p className="text-sm text-gray-600 mb-4">{selectedItem.task_name}</p>
          )}

          {historyLogs.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500">履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyLogs.map((log) => (
                <div key={log.id} className="p-3 bg-[#F2F2F7] rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(log.done_at).toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {log.notes && <p className="text-sm text-gray-600 ml-6">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Next Due Date Edit Modal */}
      <Modal
        isOpen={showNextDueModal}
        onClose={() => setShowNextDueModal(false)}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            次回予定日を編集
          </h3>
          <div className="mb-6">
            <label
              htmlFor="next-due-at-maintenance"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              次回予定日
            </label>
            <input
              type="date"
              id="next-due-at-maintenance"
              value={editingNextDueAt}
              onChange={(e) => setEditingNextDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowNextDueModal(false)}
              disabled={isSavingNextDue}
              className="flex-1 py-2.5 text-[#007AFF] font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSaveNextDue}
              disabled={isSavingNextDue}
              className="flex-1 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors disabled:opacity-50"
            >
              {isSavingNextDue ? "保存中..." : "保存"}
            </button>
          </div>
          {editingNextDueAt && (
            <button
              onClick={() => setEditingNextDueAt("")}
              disabled={isSavingNextDue}
              className="w-full mt-3 py-2 text-[#FF3B30] text-sm font-medium hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            >
              予定日をクリア
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
