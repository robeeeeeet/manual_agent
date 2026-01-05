"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import NotificationPermission from "@/components/notification/NotificationPermission";
import { MaintenanceStats, UserSettings } from "@/types/user";

export default function MyPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  // Fetch maintenance stats
  const fetchStats = async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/user/maintenance-stats");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "統計データの取得に失敗しました");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching maintenance stats:", err);
      setError(
        err instanceof Error ? err.message : "統計データの取得に失敗しました"
      );
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch user settings
  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await fetch("/api/user/settings");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "設定の取得に失敗しました");
      }
      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error("Error fetching user settings:", err);
      setError(
        err instanceof Error ? err.message : "設定の取得に失敗しました"
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  // Update notification time
  const updateNotifyTime = async (time: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notify_time: time }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "設定の更新に失敗しました");
      }

      const data = await response.json();
      setSettings(data);
    } catch (err) {
      console.error("Error updating notify time:", err);
      alert(
        err instanceof Error ? err.message : "設定の更新に失敗しました"
      );
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) {
      router.push("/");
    }
  };

  // Fetch data on mount
  useEffect(() => {
    if (!authLoading && user) {
      fetchStats();
      fetchSettings();
    }
  }, [authLoading, user]);

  // Loading state
  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Generate time options (00:00 to 23:00)
  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return `${hour}:00`;
  });

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">マイページ</h1>
        <p className="text-gray-600 mt-1">{user.email}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Maintenance Statistics */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>📊</span>
          <span>メンテナンス統計</span>
        </h2>
        {statsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* This Week */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {stats.upcoming_count}
                </div>
                <div className="text-sm text-gray-600">今週</div>
              </CardBody>
            </Card>

            {/* Overdue */}
            <Card className="bg-gradient-to-br from-red-50 to-red-100">
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-red-600 mb-1">
                  {stats.overdue_count}
                </div>
                <div className="text-sm text-gray-600">超過</div>
              </CardBody>
            </Card>

            {/* This Month */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100">
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {stats.completed_this_month}
                </div>
                <div className="text-sm text-gray-600">今月</div>
              </CardBody>
            </Card>

            {/* Total */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
              <CardBody className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {stats.completed_total}
                </div>
                <div className="text-sm text-gray-600">累計</div>
              </CardBody>
            </Card>
          </div>
        ) : (
          <Card>
            <CardBody>
              <p className="text-gray-500 text-center py-4">
                統計データがありません
              </p>
            </CardBody>
          </Card>
        )}
      </section>

      {/* Notification Settings */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>🔔</span>
          <span>通知設定</span>
        </h2>
        <NotificationPermission />
      </section>

      {/* Notification Time */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>⏰</span>
          <span>通知時刻</span>
        </h2>
        <Card>
          <CardBody>
            {settingsLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : settings ? (
              <div>
                <div className="flex items-center gap-3">
                  <select
                    value={settings.notify_time}
                    onChange={(e) => updateNotifyTime(e.target.value)}
                    disabled={saving}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  {saving && (
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  毎日この時刻にメンテナンスリマインドを送信します
                </p>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                設定の読み込みに失敗しました
              </p>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>🚪</span>
          <span>アカウント</span>
        </h2>
        <Card>
          <CardBody>
            <Button
              variant="secondary"
              onClick={handleSignOut}
              className="hover:bg-red-600 hover:border-red-600"
            >
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              ログアウト
            </Button>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
