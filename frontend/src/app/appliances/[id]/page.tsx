"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";
import { useAuth } from "@/contexts/AuthContext";
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

// iOS System Colors
const importanceConfig = {
  high: { label: "高", bg: "bg-[#FF3B30]/10", text: "text-[#FF3B30]" },
  medium: { label: "中", bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" },
  low: { label: "低", bg: "bg-[#34C759]/10", text: "text-[#34C759]" },
};

function getDueStatusConfig(daysUntil: number | null) {
  if (daysUntil === null) {
    return { label: "-", bg: "bg-gray-100", text: "text-gray-600" };
  }
  if (daysUntil < 0) {
    return {
      label: `${Math.abs(daysUntil)}日超過`,
      bg: "bg-[#FF3B30]/10",
      text: "text-[#FF3B30]",
    };
  }
  if (daysUntil === 0) {
    return { label: "今日", bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" };
  }
  if (daysUntil <= 7) {
    return {
      label: `あと${daysUntil}日`,
      bg: "bg-[#FF9500]/10",
      text: "text-[#FF9500]",
    };
  }
  return {
    label: `あと${daysUntil}日`,
    bg: "bg-[#34C759]/10",
    text: "text-[#34C759]",
  };
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
      return { href: "/maintenance", label: "メンテナンス" };
    }
    return { href: "/appliances", label: "家電" };
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

  // Archive state
  const [archivedSchedules, setArchivedSchedules] = useState<
    MaintenanceSchedule[]
  >([]);
  const [showArchivedSection, setShowArchivedSection] = useState(false);
  const [isArchiving, setIsArchiving] = useState<string | null>(null);

  // PDF loading state
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

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

        // Fetch maintenance schedules via BFF API (include archived for separation)
        const maintenanceResponse = await fetch(
          `/api/maintenance?appliance_id=${id}&include_archived=true`
        );
        if (maintenanceResponse.ok) {
          const maintenanceData: MaintenanceListResponse =
            await maintenanceResponse.json();
          // Convert MaintenanceWithAppliance to MaintenanceSchedule
          const convertedSchedules: MaintenanceSchedule[] =
            maintenanceData.items.map((item: MaintenanceWithAppliance) => ({
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
              is_archived: item.is_archived,
            }));
          // Separate active and archived schedules
          const active = convertedSchedules.filter((s) => !s.is_archived);
          const archived = convertedSchedules.filter((s) => s.is_archived);
          setSchedules(active);
          setArchivedSchedules(archived);
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

      // SWRキャッシュを無効化して一覧を再取得させる
      await mutate("/api/appliances");
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
      const maintenanceResponse = await fetch(
        `/api/maintenance?appliance_id=${id}&include_archived=true`
      );
      if (maintenanceResponse.ok) {
        const maintenanceData: MaintenanceListResponse =
          await maintenanceResponse.json();
        // Convert MaintenanceWithAppliance to MaintenanceSchedule
        const convertedSchedules: MaintenanceSchedule[] =
          maintenanceData.items.map((item: MaintenanceWithAppliance) => ({
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
            is_archived: item.is_archived,
          }));
        // Separate active and archived schedules
        const active = convertedSchedules.filter((s) => !s.is_archived);
        const archived = convertedSchedules.filter((s) => s.is_archived);
        setSchedules(active);
        setArchivedSchedules(archived);
      }
    } catch (err) {
      console.error("Error fetching schedules:", err);
    }
  };

  // Archive a maintenance schedule
  const handleArchive = async (scheduleId: string) => {
    setIsArchiving(scheduleId);
    try {
      const response = await fetch(`/api/maintenance/${scheduleId}/archive`, {
        method: "PATCH",
      });
      if (response.ok) {
        await fetchSchedules();
      } else {
        const data = await response.json();
        console.error("Archive error:", data.error);
      }
    } catch (err) {
      console.error("Archive error:", err);
    } finally {
      setIsArchiving(null);
    }
  };

  // Unarchive a maintenance schedule
  const handleUnarchive = async (scheduleId: string) => {
    setIsArchiving(scheduleId);
    try {
      const response = await fetch(`/api/maintenance/${scheduleId}/unarchive`, {
        method: "PATCH",
      });
      if (response.ok) {
        await fetchSchedules();
      } else {
        const data = await response.json();
        console.error("Unarchive error:", data.error);
      }
    } catch (err) {
      console.error("Unarchive error:", err);
    } finally {
      setIsArchiving(null);
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

  // Handle opening PDF with signed URL
  const handleOpenPdf = async () => {
    if (!appliance?.stored_pdf_path) {
      // If no stored PDF, use manual_source_url
      if (appliance?.manual_source_url) {
        window.open(appliance.manual_source_url, "_blank");
      }
      return;
    }

    setIsLoadingPdf(true);
    try {
      const response = await fetch(`/api/appliances/${id}/manual-url`);
      if (!response.ok) {
        throw new Error("署名付きURLの取得に失敗しました");
      }
      const data = await response.json();
      if (data.signed_url) {
        window.open(data.signed_url, "_blank");
      }
    } catch (err) {
      console.error("Failed to get signed URL:", err);
      // Fallback to manual_source_url if available
      if (appliance?.manual_source_url) {
        window.open(appliance.manual_source_url, "_blank");
      } else {
        setError("PDFを開けませんでした");
      }
    } finally {
      setIsLoadingPdf(false);
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

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3">
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
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
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">家電詳細</h1>
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
              家電の詳細を表示するにはログインしてください
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

  // Error or not found
  if (error || !appliance) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] pb-24">
        <header className="sticky top-0 z-10 bg-[#F2F2F7]/80 backdrop-blur-xl border-b border-gray-200/50">
          <div className="flex items-center px-4 py-3">
            <Link
              href={backLink.href}
              className="text-[#007AFF] hover:text-[#0066DD] flex items-center gap-1 mr-4"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {backLink.label}
            </Link>
          </div>
        </header>
        <div className="px-4 pt-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-[#FF3B30]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#FF3B30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-gray-900 font-medium mb-2">エラーが発生しました</p>
            <p className="text-gray-500 text-sm mb-4">{error || "家電が見つかりませんでした"}</p>
            <Link href={backLink.href}>
              <button className="px-6 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors">
                {backLink.label}に戻る
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
        <div className="flex items-center px-4 py-3">
          <Link
            href={backLink.href}
            className="text-[#007AFF] hover:text-[#0066DD] flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLink.label}
          </Link>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Appliance Info Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4">
            {/* Header with icon */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 bg-[#007AFF]/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 mb-1">
                  {appliance.name}
                </h1>
                <p className="text-gray-500 text-sm">
                  {appliance.maker} {appliance.model_number}
                </p>
                <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  {appliance.category}
                </span>
              </div>
            </div>

            {/* Manual Link */}
            {(appliance.stored_pdf_path || appliance.manual_source_url) && (
              <div className="bg-[#007AFF]/5 rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#007AFF]/10 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#007AFF]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.92,12.31 10.92,12.31Z" />
                      </svg>
                    </div>
                    <span className="font-medium text-gray-900">説明書PDF</span>
                  </div>
                  <button
                    onClick={handleOpenPdf}
                    disabled={isLoadingPdf}
                    className="text-[#007AFF] hover:text-[#0066DD] font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    {isLoadingPdf ? (
                      <>
                        <span className="w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
                        読込中...
                      </>
                    ) : (
                      <>
                        開く
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
                {/* Show original source link if both stored PDF and source URL exist */}
                {appliance.stored_pdf_path && appliance.manual_source_url && (
                  <div className="mt-2 pl-13">
                    <a
                      href={appliance.manual_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    >
                      元のサイトで見る
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Registered Date */}
            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <span className="text-gray-500 text-sm">登録日</span>
              <span className="text-gray-900 text-sm">{formatDate(appliance.created_at)}</span>
            </div>

            {/* Delete Button */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full mt-2 py-2.5 text-[#FF3B30] font-medium rounded-xl border border-[#FF3B30]/20 hover:bg-[#FF3B30]/5 transition-colors"
            >
              この家電を削除
            </button>
          </div>
        </div>

        {/* Maintenance Schedules Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">メンテナンス項目</h2>
              <span className="text-sm text-gray-500">{schedules.length}件</span>
            </div>
          </div>

          {schedules.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">メンテナンス項目は登録されていません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {schedules.map((schedule) => {
                const daysUntil = getDaysUntilDue(schedule.next_due_at);
                const statusConfig = getDueStatusConfig(daysUntil);
                const impConfig = importanceConfig[schedule.importance];

                return (
                  <div
                    key={schedule.id}
                    onClick={() => openDetailModal(schedule)}
                    className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer transition-colors"
                  >
                    {/* Task name */}
                    <h4 className="font-medium text-gray-900 mb-2" title={schedule.task_name}>
                      {schedule.task_name}
                    </h4>

                    {/* Badges and actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${impConfig.bg} ${impConfig.text}`}>
                          {impConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {/* Archive button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchive(schedule.id);
                          }}
                          disabled={isArchiving === schedule.id}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
                          title="アーカイブ"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteScheduleModal(schedule);
                          }}
                          className="p-2 text-gray-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-full transition-colors"
                          title="削除"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        {/* Complete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openCompleteModal(schedule);
                          }}
                          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                            daysUntil !== null && daysUntil < 0
                              ? "bg-[#FF3B30] text-white hover:bg-[#E5342B]"
                              : "bg-[#007AFF] text-white hover:bg-[#0066DD]"
                          }`}
                        >
                          完了
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Archived Section */}
          {archivedSchedules.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowArchivedSection(!showArchivedSection)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showArchivedSection ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                アーカイブ済み ({archivedSchedules.length}件)
              </button>

              {showArchivedSection && (
                <div className="mt-3 space-y-2">
                  {archivedSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="p-3 bg-white rounded-xl opacity-70"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 line-through text-sm">
                          {schedule.task_name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnarchive(schedule.id)}
                          disabled={isArchiving === schedule.id}
                          className="text-sm text-[#007AFF] hover:text-[#0066DD] disabled:opacity-50"
                        >
                          {isArchiving === schedule.id ? "復元中..." : "復元"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Q&A Section */}
        {appliance.shared_appliance_id && (
          <QASection
            sharedApplianceId={appliance.shared_appliance_id}
            manufacturer={appliance.maker}
            modelNumber={appliance.model_number}
            hasPdf={!!appliance.stored_pdf_path}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        variant="dialog"
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            家電を削除しますか？
          </h3>
          <p className="text-gray-600 text-sm mb-6">
            「{appliance.name}」を削除すると、関連するメンテナンス記録もすべて削除されます。
            この操作は取り消せません。
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              className="flex-1 py-2.5 text-[#007AFF] font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 py-2.5 bg-[#FF3B30] text-white font-semibold rounded-xl hover:bg-[#E5342B] transition-colors disabled:opacity-50"
            >
              {isDeleting ? "削除中..." : "削除する"}
            </button>
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#007AFF]/50 focus:border-[#007AFF] resize-none transition-colors"
                  placeholder="作業の内容や気づいた点などを記録できます"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  disabled={isCompleting}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCompleteModal(false);
                setSelectedSchedule(null);
                setCompletionNotes("");
              }}
              disabled={isCompleting}
              className="flex-1 py-2.5 text-[#007AFF] font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="flex-1 py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors disabled:opacity-50"
            >
              {isCompleting ? "記録中..." : "完了する"}
            </button>
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
              <div className="w-8 h-8 border-4 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
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
                  className="p-3 bg-gray-50 rounded-xl"
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
                  <SafeHtml html={selectedSchedule.description} className="text-gray-700 text-sm" />
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
                    className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                      importanceConfig[selectedSchedule.importance].bg
                    } ${importanceConfig[selectedSchedule.importance].text}`}
                  >
                    {importanceConfig[selectedSchedule.importance].label}
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
                      const daysUntil = getDaysUntilDue(selectedSchedule.next_due_at);
                      const statusConfig = getDueStatusConfig(daysUntil);
                      return (
                        <span
                          className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}
                        >
                          {statusConfig.label}
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
                className="text-sm text-[#007AFF] hover:text-[#0066DD] mb-6 disabled:opacity-50"
              >
                完了履歴を表示
              </button>

              {/* Action button */}
              <div className="pt-4 border-t">
                <button
                  onClick={handleDetailToComplete}
                  className="w-full py-2.5 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-[#0066DD] transition-colors"
                >
                  完了する
                </button>
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
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            メンテナンス項目を削除
          </h3>
          <p className="text-gray-600 text-sm mb-6">
            「{scheduleToDelete?.task_name}」を削除しますか？
            この操作は取り消せません。
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowDeleteScheduleModal(false);
                setScheduleToDelete(null);
              }}
              disabled={isDeletingSchedule}
              className="flex-1 py-2.5 text-[#007AFF] font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleDeleteSchedule}
              disabled={isDeletingSchedule}
              className="flex-1 py-2.5 bg-[#FF3B30] text-white font-semibold rounded-xl hover:bg-[#E5342B] transition-colors disabled:opacity-50"
            >
              {isDeletingSchedule ? "削除中..." : "削除"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
