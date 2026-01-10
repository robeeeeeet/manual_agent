"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import FeatureCard from "@/components/ui/FeatureCard";
import { useAuth } from "@/contexts/AuthContext";
import MaintenanceListItem from "@/components/maintenance/MaintenanceListItem";
import MaintenanceCompleteModal from "@/components/maintenance/MaintenanceCompleteModal";
import {
  UserApplianceWithDetails,
  MaintenanceWithAppliance,
  MaintenanceListResponse,
  MaintenanceSchedule,
} from "@/types/appliance";

interface HomeMaintenanceSchedule {
  id: string;
  task_name: string;
  next_due_at: string;
  importance: "high" | "medium" | "low";
}

// Extended type for home page (includes maintenance schedules for future use)
interface ApplianceWithMaintenance extends UserApplianceWithDetails {
  maintenance_schedules?: HomeMaintenanceSchedule[];
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [appliances, setAppliances] = useState<ApplianceWithMaintenance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Urgent maintenance state
  const [urgentMaintenance, setUrgentMaintenance] = useState<
    MaintenanceWithAppliance[]
  >([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);

  // Complete modal state
  const [selectedItem, setSelectedItem] =
    useState<MaintenanceWithAppliance | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Fetch appliances and maintenance data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setIsLoading(false);
        setMaintenanceLoading(false);
        return;
      }

      try {
        // Fetch appliances and maintenance in parallel
        const [appliancesRes, maintenanceRes] = await Promise.all([
          fetch("/api/appliances"),
          fetch("/api/maintenance?status=overdue,upcoming"),
        ]);

        if (appliancesRes.ok) {
          const appliancesData = await appliancesRes.json();
          setAppliances(appliancesData.slice(0, 3));
        }

        if (maintenanceRes.ok) {
          const maintenanceData: MaintenanceListResponse =
            await maintenanceRes.json();
          // Show up to 5 urgent items
          setUrgentMaintenance(maintenanceData.items.slice(0, 5));
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
        setMaintenanceLoading(false);
      }
    };

    if (!authLoading) {
      fetchData();
    }
  }, [user, authLoading]);

  // Refetch maintenance after completion
  const refetchMaintenance = async () => {
    try {
      const response = await fetch("/api/maintenance?status=overdue,upcoming");
      if (response.ok) {
        const data: MaintenanceListResponse = await response.json();
        setUrgentMaintenance(data.items.slice(0, 5));
      }
    } catch (err) {
      console.error("Error refetching maintenance:", err);
    }
  };

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

  // Get the nearest due maintenance for an appliance
  const getNearestDueMaintenance = (
    schedules: HomeMaintenanceSchedule[]
  ): HomeMaintenanceSchedule | null => {
    if (!schedules || schedules.length === 0) return null;

    const sortedSchedules = [...schedules].sort(
      (a, b) =>
        new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime()
    );

    return sortedSchedules[0] || null;
  };

  // Get days until due
  const getDaysUntilDue = (dateString: string): number => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateString);
    dueDate.setHours(0, 0, 0, 0);
    return Math.floor(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  // Get status badge color based on days until due
  const getDueStatusColor = (daysUntil: number): string => {
    if (daysUntil < 0) return "bg-red-100 text-red-700";
    if (daysUntil <= 7) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
  };

  // Get status text based on days until due
  const getDueStatusText = (daysUntil: number): string => {
    if (daysUntil < 0) return `${Math.abs(daysUntil)}日超過`;
    if (daysUntil === 0) return "今日";
    if (daysUntil === 1) return "明日";
    return `${daysUntil}日後`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          説明書管理 & メンテナンスリマインド
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          家電や住宅設備の説明書を管理し、
          <br className="hidden sm:inline" />
          メンテナンス項目を自動でリマインドします
        </p>
        <Link href="/register">
          <Button size="lg">
            <svg
              className="w-5 h-5 mr-2"
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
            家電を登録する
          </Button>
        </Link>
      </section>

      {/* Urgent Maintenance Section */}
      {user && !authLoading && !maintenanceLoading && urgentMaintenance.length > 0 && (
        <section className="py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              期限が近いメンテナンス
            </h2>
            <Link
              href="/maintenance"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              すべて見る →
            </Link>
          </div>
          <Card>
            <CardBody className="py-2">
              {urgentMaintenance.map((item) => (
                <MaintenanceListItem
                  key={item.id}
                  item={item}
                  onComplete={openCompleteModal}
                  showApplianceName={true}
                  compact={true}
                />
              ))}
            </CardBody>
          </Card>
        </section>
      )}

      {/* Appliance List */}
      <section className="py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">登録済みの家電</h2>
          {appliances.length > 0 && (
            <Link
              href="/appliances"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              すべて見る →
            </Link>
          )}
        </div>

        {/* Loading State */}
        {(authLoading || isLoading) && user && (
          <Card>
            <CardBody className="py-12">
              <div className="flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            </CardBody>
          </Card>
        )}

        {/* Not logged in state */}
        {!authLoading && !user && (
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
                登録した家電を表示するにはログインが必要です
              </p>
              <div className="flex justify-center gap-3">
                <Link href="/login">
                  <Button variant="outline">ログイン</Button>
                </Link>
                <Link href="/signup">
                  <Button>新規登録</Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Empty State */}
        {!authLoading && !isLoading && user && appliances.length === 0 && (
          <Card>
            <CardBody className="py-16 text-center">
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
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">
                まだ家電が登録されていません
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                家電を登録して、メンテナンス管理を始めましょう
              </p>
              <Link href="/register">
                <Button variant="outline">家電を登録する</Button>
              </Link>
            </CardBody>
          </Card>
        )}

        {/* Appliance Cards */}
        {!authLoading && !isLoading && appliances.length > 0 && (
          <div className="space-y-4">
            {appliances.map((appliance) => {
              const nearestMaintenance = getNearestDueMaintenance(
                appliance.maintenance_schedules || []
              );
              const daysUntil = nearestMaintenance
                ? getDaysUntilDue(nearestMaintenance.next_due_at)
                : null;

              return (
                <Card key={appliance.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900">
                            {appliance.name}
                          </h3>
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                            {appliance.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {appliance.maker} {appliance.model_number}
                        </p>

                        {/* Maintenance info */}
                        {nearestMaintenance && daysUntil !== null && (
                          <div className="mt-3 flex items-center gap-2 min-w-0">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${getDueStatusColor(
                                daysUntil
                              )}`}
                            >
                              {getDueStatusText(daysUntil)}
                            </span>
                            <span
                              className="text-sm text-gray-600 line-clamp-2"
                              title={nearestMaintenance.task_name}
                            >
                              {nearestMaintenance.task_name}
                            </span>
                          </div>
                        )}

                        {appliance.maintenance_schedules &&
                          appliance.maintenance_schedules.length > 0 && (
                            <p className="text-xs text-gray-500 mt-2">
                              {appliance.maintenance_schedules.length}
                              件のメンテナンス項目
                            </p>
                          )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {appliance.manual_source_url && (
                          <a
                            href={appliance.manual_source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            説明書
                          </a>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Features - Page Footer */}
      <section className="mt-12 pt-8 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
            title="AI画像認識"
            description="写真からメーカー・型番を自動認識"
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
          />
          <FeatureCard
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            }
            title="説明書自動取得"
            description="公式PDFを自動で検索・保存"
            iconBgColor="bg-green-50"
            iconColor="text-green-600"
          />
          <FeatureCard
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            }
            title="リマインド通知"
            description="メンテナンス時期をお知らせ"
            iconBgColor="bg-orange-50"
            iconColor="text-orange-600"
          />
        </div>
      </section>

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
