"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import { QASection } from "@/components/qa/QASection";
import { SafeHtml } from "@/components/ui/SafeHtml";
import type {
  UserApplianceWithDetails,
  MaintenanceSchedule,
  MaintenanceLog,
  MaintenanceWithAppliance,
  MaintenanceListResponse,
} from "@/types/appliance";

interface ApplianceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ApplianceDetailPage({
  params,
}: ApplianceDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // Determine back link based on referrer
  const backLink = useMemo(() => {
    const from = searchParams.get("from");
    if (from === "maintenance") {
      return { href: "/maintenance", label: "メンテナンス一覧に戻る" };
    }
    return { href: "/appliances", label: "家電一覧に戻る" };
  }, [searchParams]);

  const [appliance, setAppliance] = useState<UserApplianceWithDetails | null>(
    null
  );
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Completion modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] =
    useState<MaintenanceSchedule | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<MaintenanceLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Maintenance schedule delete state
  const [showDeleteScheduleModal, setShowDeleteScheduleModal] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] =
    useState<MaintenanceSchedule | null>(null);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);

  // Fetch appliance details
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch appliance details via BFF
        const response = await fetch(`/api/appliances/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("この家電は見つかりませんでした");
          }
          throw new Error("家電データの取得に失敗しました");
        }
        const applianceData: UserApplianceWithDetails = await response.json();
        setAppliance(applianceData);

        // Fetch maintenance schedules via BFF API
        const maintenanceResponse = await fetch(`/api/maintenance?appliance_id=${id}`);
        if (maintenanceResponse.ok) {
          const maintenanceData: MaintenanceListResponse = await maintenanceResponse.json();
          // Convert MaintenanceWithAppliance to MaintenanceSchedule
          const convertedSchedules: MaintenanceSchedule[] = maintenanceData.items.map(
            (item: MaintenanceWithAppliance) => ({
              id: item.id,
              user_appliance_id: item.appliance_id,
              shared_item_id: null,
              task_name: item.task_name,
              description: item.description,
              interval_type: item.interval_type,
              interval_value: item.interval_value,
              last_done_at: item.last_done_at,
              next_due_at: item.next_due_at,
              source_page: item.source_page,
              importance: item.importance,
              created_at: "",
              updated_at: "",
            })
          );
          setSchedules(convertedSchedules);
        }
      } catch (err) {
        console.error("Error fetching appliance:", err);
        setError(
          err instanceof Error ? err.message : "家電データの取得に失敗しました"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [id, user, authLoading]);

  // Delete appliance
  const handleDelete = async () => {
    if (!appliance) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/appliances/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("削除に失敗しました");
      }

      router.push("/appliances");
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Fetch maintenance schedules
  const fetchSchedules = async () => {
    try {
      const maintenanceResponse = await fetch(`/api/maintenance?appliance_id=${id}`);
      if (maintenanceResponse.ok) {
        const maintenanceData: MaintenanceListResponse = await maintenanceResponse.json();
        // Convert MaintenanceWithAppliance to MaintenanceSchedule
        const convertedSchedules: MaintenanceSchedule[] = maintenanceData.items.map(
          (item: MaintenanceWithAppliance) => ({
            id: item.id,
            user_appliance_id: item.appliance_id,
            shared_item_id: null,
            task_name: item.task_name,
            description: item.description,
            interval_type: item.interval_type,
            interval_value: item.interval_value,
            last_done_at: item.last_done_at,
            next_due_at: item.next_due_at,
            source_page: item.source_page,
            importance: item.importance,
            created_at: "",
            updated_at: "",
          })
        );
        setSchedules(convertedSchedules);
      }
    } catch (err) {
      console.error("Error fetching schedules:", err);
    }
  };

  // Open completion modal
  const openCompleteModal = (schedule: MaintenanceSchedule) => {
    setSelectedSchedule(schedule);
    setCompletionNotes("");
    setShowCompleteModal(true);
  };

  // Open detail modal
  const openDetailModal = (schedule: MaintenanceSchedule) => {
    setSelectedSchedule(schedule);
    setShowDetailModal(true);
  };

  // Transition from detail modal to complete modal
  const handleDetailToComplete = () => {
    setShowDetailModal(false);
    setShowCompleteModal(true);
  };

  // Transition from detail modal to history modal
  const handleDetailToHistory = async () => {
    if (selectedSchedule) {
      setShowDetailModal(false);
      await fetchHistory(selectedSchedule.id);
    }
  };

  // Handle completion
  const handleComplete = async () => {
    if (!selectedSchedule) return;

    setIsCompleting(true);
    try {
      const response = await fetch(
        `/api/appliances/maintenance-schedules/${selectedSchedule.id}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: completionNotes || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "完了記録に失敗しました");
      }

      // Refresh schedules
      await fetchSchedules();

      // Close modal
      setShowCompleteModal(false);
      setSelectedSchedule(null);
      setCompletionNotes("");
    } catch (err) {
      console.error("Complete error:", err);
      setError(
        err instanceof Error ? err.message : "完了記録に失敗しました"
      );
    } finally {
      setIsCompleting(false);
    }
  };

  // Open delete schedule modal
  const openDeleteScheduleModal = (schedule: MaintenanceSchedule) => {
    setScheduleToDelete(schedule);
    setShowDeleteScheduleModal(true);
  };

  // Handle delete schedule
  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    setIsDeletingSchedule(true);
    try {
      const response = await fetch(
        `/api/maintenance/${scheduleToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "削除に失敗しました");
      }

      // Refresh schedules
      await fetchSchedules();

      // Close modal
      setShowDeleteScheduleModal(false);
      setScheduleToDelete(null);
    } catch (err) {
      console.error("Delete schedule error:", err);
      setError(
        err instanceof Error ? err.message : "削除に失敗しました"
      );
    } finally {
      setIsDeletingSchedule(false);
    }
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
      // Handle both array response and object with logs property
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

  // Calculate days until due (date-only comparison, ignoring time)
  const getDaysUntilDue = (nextDueAt: string | null): number | null => {
    if (!nextDueAt) return null;
    const now = new Date();
    const dueDate = new Date(nextDueAt);
    // Compare dates only, ignoring time
    const nowDateOnly = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const dueDateOnly = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate()
    );
    const diffTime = dueDateOnly.getTime() - nowDateOnly.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get status color based on days until due
  const getDueStatusColor = (daysUntil: number | null): string => {
    if (daysUntil === null) return "bg-gray-100 text-gray-600";
    if (daysUntil < 0) return "bg-red-100 text-red-700";
    if (daysUntil <= 7) return "bg-amber-100 text-amber-700";
    return "bg-green-100 text-green-700";
  };

  // Get importance badge color
  const getImportanceBadgeColor = (
    importance: "high" | "medium" | "low"
  ): string => {
    switch (importance) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const importanceLabels: Record<"high" | "medium" | "low", string> = {
    high: "高",
    medium: "中",
    low: "低",
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          ログインが必要です
        </h1>
        <p className="text-gray-600 mb-6">
          家電の詳細を表示するにはログインしてください。
        </p>
        <Link href="/login">
          <Button>ログイン</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !appliance) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link
          href={backLink.href}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4"
        >
          <svg
            className="w-4 h-4"
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
          {backLink.label}
        </Link>
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">
                {error || "家電が見つかりませんでした"}
              </p>
              <Link href={backLink.href}>
                <Button>{backLink.label}</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={backLink.href}
          className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4"
        >
          <svg
            className="w-4 h-4"
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
          {backLink.label}
        </Link>
      </div>

      {/* Appliance Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {appliance.name}
              </h1>
              <p className="text-gray-600 mt-1">
                {appliance.maker} {appliance.model_number}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700">
                {appliance.category}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            {/* Manual Link */}
            {(appliance.stored_pdf_path || appliance.manual_source_url) && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.92,12.31 10.92,12.31Z" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900">説明書PDF</span>
                  </div>
                  <a
                    href={
                      appliance.stored_pdf_path
                        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/manuals/${appliance.stored_pdf_path}`
                        : appliance.manual_source_url || "#"
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    開く
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
                {/* Show original source link if both stored PDF and source URL exist */}
                {appliance.stored_pdf_path && appliance.manual_source_url && (
                  <div className="mt-2 pl-13 ml-13">
                    <a
                      href={appliance.manual_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      元のサイトで見る
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Registered Date */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">登録日</span>
              <span className="text-gray-900">
                {formatDate(appliance.created_at)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t items-center">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(true)}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                削除
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Maintenance Schedules Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">メンテナンス項目</h2>
            <span className="text-sm text-gray-500">
              {schedules.length}件
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {schedules.length === 0 ? (
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-gray-500">
                メンテナンス項目は登録されていません
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((schedule) => {
                const daysUntil = getDaysUntilDue(schedule.next_due_at);
                const statusColor = getDueStatusColor(daysUntil);

                return (
                  <div
                    key={schedule.id}
                    onClick={() => openDetailModal(schedule)}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    {/* Task name - full width */}
                    <h4
                      className="font-medium text-gray-900 leading-snug mb-2"
                      title={schedule.task_name}
                    >
                      {schedule.task_name}
                    </h4>

                    {/* Bottom row: badges and complete button */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {/* Importance badge */}
                        <span
                          className={`px-1.5 py-0.5 text-xs font-medium rounded ${getImportanceBadgeColor(
                            schedule.importance
                          )}`}
                        >
                          {importanceLabels[schedule.importance]}
                        </span>

                        {/* Due status badge */}
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor}`}
                        >
                          {daysUntil === null
                            ? "未設定"
                            : daysUntil < 0
                              ? `${Math.abs(daysUntil)}日超過`
                              : daysUntil === 0
                                ? "今日"
                                : `あと${daysUntil}日`}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteScheduleModal(schedule);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="削除"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>

                        {/* Complete button */}
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCompleteModal(schedule);
                          }}
                          className={
                            daysUntil !== null && daysUntil < 0
                              ? "bg-red-600 hover:bg-red-700"
                              : ""
                          }
                        >
                          完了
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Q&A Section */}
      {appliance.shared_appliance_id && (
        <div className="mt-6">
          <QASection
            sharedApplianceId={appliance.shared_appliance_id}
            manufacturer={appliance.maker}
            modelNumber={appliance.model_number}
            hasPdf={!!appliance.stored_pdf_path}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            家電を削除しますか？
          </h3>
          <p className="text-gray-600 mb-6">
            「{appliance.name}」を削除すると、関連するメンテナンス記録もすべて削除されます。
            この操作は取り消せません。
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              className="flex-1"
              disabled={isDeleting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleDelete}
              isLoading={isDeleting}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              削除する
            </Button>
          </div>
        </div>
      </Modal>

      {/* Completion Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => {
          if (!isCompleting) {
            setShowCompleteModal(false);
            setSelectedSchedule(null);
            setCompletionNotes("");
          }
        }}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            メンテナンスを完了する
          </h3>
          {selectedSchedule && (
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                <span className="font-medium text-gray-900">
                  {selectedSchedule.task_name}
                </span>
                <br />
                を完了しますか？
              </p>

              {/* Notes input */}
              <div>
                <label
                  htmlFor="completion-notes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  メモ（任意）
                </label>
                <textarea
                  id="completion-notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="作業の内容や気づいた点などを記録できます"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  disabled={isCompleting}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCompleteModal(false);
                setSelectedSchedule(null);
                setCompletionNotes("");
              }}
              className="flex-1"
              disabled={isCompleting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleComplete}
              isLoading={isCompleting}
              className="flex-1"
            >
              完了する
            </Button>
          </div>
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

          <h3 className="text-lg font-bold text-gray-900 mb-4 pr-8">完了履歴</h3>

          {isLoadingHistory ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {historyLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(log.done_at)}
                      </p>
                      {log.notes && (
                        <p className="text-sm text-gray-600 mt-1">
                          {log.notes}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(log.done_at).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSchedule(null);
        }}
        variant="dialog"
      >
        <div className="p-6">
          {/* Close button */}
          <button
            onClick={() => {
              setShowDetailModal(false);
              setSelectedSchedule(null);
            }}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {selectedSchedule && (
            <>
              {/* Header */}
              <h3 className="text-lg font-bold text-gray-900 mb-4 pr-8">
                {selectedSchedule.task_name}
              </h3>

              {/* Description */}
              {selectedSchedule.description && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-1">
                    説明
                  </h4>
                  <SafeHtml html={selectedSchedule.description} className="text-gray-700" />
                </div>
              )}

              {/* Meta info grid */}
              <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y border-gray-100">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">
                    周期
                  </h4>
                  <p className="text-sm text-gray-900">
                    {selectedSchedule.interval_type === "days"
                      ? `${selectedSchedule.interval_value}日ごと`
                      : selectedSchedule.interval_type === "months"
                        ? `${selectedSchedule.interval_value}ヶ月ごと`
                        : "手動"}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-gray-500 mb-1">
                    重要度
                  </h4>
                  <span
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${getImportanceBadgeColor(
                      selectedSchedule.importance
                    )}`}
                  >
                    {importanceLabels[selectedSchedule.importance]}
                  </span>
                </div>
                {selectedSchedule.source_page && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 mb-1">
                      参照ページ
                    </h4>
                    <p className="text-sm text-gray-900">
                      {selectedSchedule.source_page}
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
                      {formatDate(selectedSchedule.next_due_at)}
                    </span>
                    {(() => {
                      const daysUntil = getDaysUntilDue(
                        selectedSchedule.next_due_at
                      );
                      const statusColor = getDueStatusColor(daysUntil);
                      return (
                        <span
                          className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${statusColor}`}
                        >
                          {daysUntil === null
                            ? "未設定"
                            : daysUntil < 0
                              ? `${Math.abs(daysUntil)}日超過`
                              : daysUntil === 0
                                ? "今日"
                                : `あと${daysUntil}日`}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                {selectedSchedule.last_done_at && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">最終完了日</span>
                    <span className="text-sm text-gray-900">
                      {formatDate(selectedSchedule.last_done_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* History link */}
              <button
                onClick={handleDetailToHistory}
                disabled={isLoadingHistory}
                className="text-sm text-blue-600 hover:text-blue-700 mb-6 disabled:opacity-50"
              >
                完了履歴を表示
              </button>

              {/* Action button */}
              <div className="pt-4 border-t">
                <Button onClick={handleDetailToComplete} className="w-full">
                  完了する
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Schedule Confirmation Modal */}
      <Modal
        isOpen={showDeleteScheduleModal}
        onClose={() => {
          setShowDeleteScheduleModal(false);
          setScheduleToDelete(null);
        }}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            メンテナンス項目を削除
          </h3>
          <p className="text-gray-600 mb-4">
            「{scheduleToDelete?.task_name}」を削除しますか？
            この操作は取り消せません。
          </p>

          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowDeleteScheduleModal(false);
                setScheduleToDelete(null);
              }}
              disabled={isDeletingSchedule}
            >
              キャンセル
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteSchedule}
              isLoading={isDeletingSchedule}
              className="bg-red-600 hover:bg-red-700"
            >
              削除
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
