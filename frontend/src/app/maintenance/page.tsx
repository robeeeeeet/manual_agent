"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import MaintenanceStatusTabs, {
  type TabStatus,
} from "@/components/maintenance/MaintenanceStatusTabs";
import MaintenanceFilter from "@/components/maintenance/MaintenanceFilter";
import MaintenanceListItem from "@/components/maintenance/MaintenanceListItem";
import MaintenanceCompleteModal from "@/components/maintenance/MaintenanceCompleteModal";
import type {
  MaintenanceWithAppliance,
  MaintenanceCounts,
  MaintenanceListResponse,
  MaintenanceSchedule,
  MaintenanceLog,
} from "@/types/appliance";

interface ApplianceOption {
  id: string;
  name: string;
}

const importanceLabels: Record<"high" | "medium" | "low", string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const importanceColors: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

export default function MaintenancePage() {
  const { user, loading: authLoading } = useAuth();

  // Data state
  const [allItems, setAllItems] = useState<MaintenanceWithAppliance[]>([]);
  const [counts, setCounts] = useState<MaintenanceCounts>({
    overdue: 0,
    upcoming: 0,
    scheduled: 0,
    manual: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [activeTab, setActiveTab] = useState<TabStatus>("all");
  const [importanceFilter, setImportanceFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [applianceFilter, setApplianceFilter] = useState<string | null>(null);

  // Modal state
  const [selectedItem, setSelectedItem] =
    useState<MaintenanceWithAppliance | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<MaintenanceLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Extract unique appliances for filter dropdown
  const appliances = useMemo<ApplianceOption[]>(() => {
    const uniqueAppliances = new Map<string, string>();
    allItems.forEach((item) => {
      if (!uniqueAppliances.has(item.appliance_id)) {
        uniqueAppliances.set(item.appliance_id, item.appliance_name);
      }
    });
    return Array.from(uniqueAppliances.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [allItems]);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Tab filter
      if (activeTab !== "all" && item.status !== activeTab) {
        return false;
      }

      // Importance filter
      if (importanceFilter !== "all" && item.importance !== importanceFilter) {
        return false;
      }

      // Appliance filter
      if (applianceFilter && item.appliance_id !== applianceFilter) {
        return false;
      }

      return true;
    });
  }, [allItems, activeTab, importanceFilter, applianceFilter]);

  // Fetch maintenance data
  const fetchMaintenance = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/maintenance");
      if (!response.ok) {
        throw new Error("メンテナンスデータの取得に失敗しました");
      }
      const data: MaintenanceListResponse = await response.json();
      setAllItems(data.items);
      setCounts(data.counts);
    } catch (err) {
      console.error("Error fetching maintenance:", err);
      setError(
        err instanceof Error
          ? err.message
          : "メンテナンスデータの取得に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchMaintenance();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading]);

  // Handle item click for detail modal
  const openDetailModal = (item: MaintenanceWithAppliance) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  // Handle completion
  const openCompleteModal = (item: MaintenanceWithAppliance) => {
    setSelectedItem(item);
    setShowCompleteModal(true);
  };

  const handleCompleteSuccess = () => {
    setShowCompleteModal(false);
    setSelectedItem(null);
    fetchMaintenance();
  };

  // Fetch history
  const fetchHistory = async (scheduleId: string) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(
        `/api/appliances/maintenance-schedules/${scheduleId}/logs`
      );

      if (!response.ok) {
        throw new Error("履歴の取得に失敗しました");
      }

      const data = await response.json();
      const logs: MaintenanceLog[] = Array.isArray(data) ? data : data.logs || [];
      setHistoryLogs(logs);
      setShowHistoryModal(true);
    } catch (err) {
      console.error("Fetch history error:", err);
      setError(
        err instanceof Error ? err.message : "履歴の取得に失敗しました"
      );
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "未設定";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get status text
  const getStatusText = (daysUntilDue: number | null, status: string): string => {
    if (status === "manual") return "手動";
    if (daysUntilDue === null) return "未設定";
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}日超過`;
    if (daysUntilDue === 0) return "今日";
    if (daysUntilDue === 1) return "明日";
    return `あと${daysUntilDue}日`;
  };

  // Get status color
  const getStatusColor = (daysUntilDue: number | null, status: string): string => {
    if (status === "manual") return "bg-gray-100 text-gray-600";
    if (daysUntilDue === null) return "bg-gray-100 text-gray-600";
    if (daysUntilDue < 0) return "bg-red-100 text-red-700";
    if (daysUntilDue <= 7) return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
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

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          メンテナンス一覧
        </h1>
        <Card>
          <CardBody className="py-12">
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          メンテナンス一覧
        </h1>
        <Card>
          <CardBody className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
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
            </div>
            <h3 className="font-medium text-gray-900 mb-2">
              ログインしてください
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              メンテナンス一覧を表示するにはログインが必要です
            </p>
            <Link
              href="/login"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              ログイン
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          メンテナンス一覧
        </h1>
        <Card>
          <CardBody className="py-12 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
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
            </div>
            <h3 className="font-medium text-gray-900 mb-2">
              エラーが発生しました
            </h3>
            <p className="text-sm text-gray-500 mb-6">{error}</p>
            <button
              onClick={fetchMaintenance}
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              再読み込み
            </button>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Empty state
  if (allItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          メンテナンス一覧
        </h1>
        <Card>
          <CardBody className="py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">
              メンテナンス項目がありません
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              家電を登録してメンテナンス項目を追加しましょう
            </p>
            <Link
              href="/register"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              家電を登録する
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        メンテナンス一覧
      </h1>

      {/* Status Tabs */}
      <div className="mb-4">
        <MaintenanceStatusTabs
          activeTab={activeTab}
          counts={counts}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Filters */}
      <div className="mb-6">
        <MaintenanceFilter
          importance={importanceFilter}
          applianceId={applianceFilter}
          appliances={appliances}
          onImportanceChange={setImportanceFilter}
          onApplianceChange={setApplianceFilter}
        />
      </div>

      {/* Items list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">メンテナンス項目</h2>
            <span className="text-sm text-gray-500">
              {filteredItems.length}件
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {filteredItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                該当するメンテナンス項目がありません
              </p>
            </div>
          ) : (
            <div className="space-y-2">
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
        </CardBody>
      </Card>

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
        <div className="p-6">
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
              {/* Header */}
              <h3 className="text-lg font-bold text-gray-900 mb-4 pr-8">
                {selectedItem.task_name}
              </h3>

              {/* Description */}
              {selectedItem.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">
                    説明
                  </h4>
                  <p className="text-gray-700">{selectedItem.description}</p>
                </div>
              )}

              {/* Appliance info */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 mb-1">
                  家電
                </h4>
                <p className="text-sm text-gray-900">{selectedItem.appliance_name}</p>
                <p className="text-xs text-gray-500">
                  {selectedItem.maker} {selectedItem.model_number}
                </p>
              </div>

              {/* Meta info grid */}
              <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y border-gray-100">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">
                    周期
                  </h4>
                  <p className="text-sm text-gray-900">
                    {selectedItem.interval_type === "days"
                      ? `${selectedItem.interval_value}日ごと`
                      : selectedItem.interval_type === "months"
                        ? `${selectedItem.interval_value}ヶ月ごと`
                        : "手動"}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">
                    重要度
                  </h4>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${importanceColors[selectedItem.importance]}`}
                  >
                    {importanceLabels[selectedItem.importance]}
                  </span>
                </div>
                {selectedItem.source_page && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">
                      参照ページ
                    </h4>
                    <p className="text-sm text-gray-900">
                      {selectedItem.source_page}
                    </p>
                  </div>
                )}
              </div>

              {/* Date info */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">次回予定日</span>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">
                      {formatDate(selectedItem.next_due_at)}
                    </span>
                    <span
                      className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(selectedItem.days_until_due, selectedItem.status)}`}
                    >
                      {getStatusText(selectedItem.days_until_due, selectedItem.status)}
                    </span>
                  </div>
                </div>
                {selectedItem.last_done_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">前回実施日</span>
                    <span className="text-sm text-gray-900">
                      {formatDate(selectedItem.last_done_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => fetchHistory(selectedItem.id)}
                  className="flex-1"
                  isLoading={isLoadingHistory}
                >
                  履歴を見る
                </Button>
                <Button
                  onClick={() => {
                    setShowDetailModal(false);
                    openCompleteModal(selectedItem);
                  }}
                  className="flex-1"
                >
                  完了する
                </Button>
              </div>

              {/* Link to appliance detail */}
              <div className="mt-4 text-center">
                <Link
                  href={`/appliances/${selectedItem.appliance_id}`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  家電詳細ページへ →
                </Link>
              </div>
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
          {/* Close button */}
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

          <h3 className="text-lg font-bold text-gray-900 mb-4 pr-8">
            メンテナンス履歴
          </h3>
          {selectedItem && (
            <p className="text-sm text-gray-600 mb-4">
              {selectedItem.task_name}
            </p>
          )}

          {historyLogs.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-500">履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
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
                  {log.notes && (
                    <p className="text-sm text-gray-600 ml-6">{log.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
