"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import NotificationPermission from "@/components/notification/NotificationPermission";
import { MaintenanceStats, UserSettings, UserUsageStats } from "@/types/user";
import UsageBar from "@/components/tier/UsageBar";

export default function MyPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [usageStats, setUsageStats] = useState<UserUsageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState("");

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

  // Fetch usage statistics
  const fetchUsageStats = async () => {
    setUsageLoading(true);
    try {
      const response = await fetch("/api/user/usage");
      if (response.ok) {
        const data = await response.json();
        setUsageStats(data);
      }
    } catch (err) {
      console.error("Error fetching usage stats:", err);
    } finally {
      setUsageLoading(false);
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

  // Update display name
  const updateDisplayName = async () => {
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      alert("表示名を入力してください");
      return;
    }
    if (trimmed.length > 20) {
      alert("表示名は20文字以内で入力してください");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "表示名の更新に失敗しました");
      }

      const data = await response.json();
      setSettings(data);
      setEditingDisplayName(false);
    } catch (err) {
      console.error("Error updating display name:", err);
      alert(
        err instanceof Error ? err.message : "表示名の更新に失敗しました"
      );
    } finally {
      setSaving(false);
    }
  };

  // Start editing display name
  const startEditingDisplayName = () => {
    setDisplayNameInput(settings?.display_name || "");
    setEditingDisplayName(true);
  };

  // Cancel editing display name
  const cancelEditingDisplayName = () => {
    setEditingDisplayName(false);
    setDisplayNameInput("");
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
      fetchUsageStats();
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

      {/* プラン & 利用状況 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>📋</span>
          <span>プラン & 利用状況</span>
        </h2>
        {usageLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : usageStats ? (
          <Card>
            <CardBody>
              <div className="mb-4">
                <span className="text-sm text-gray-600">現在のプラン: </span>
                <span className="font-semibold text-blue-600">
                  {usageStats.tier.display_name}
                </span>
              </div>
              <div className="space-y-3">
                <UsageBar
                  label="登録家電"
                  current={usageStats.appliance_count}
                  limit={usageStats.tier.max_appliances}
                />
                <UsageBar
                  label="説明書検索（今日）"
                  current={usageStats.daily_usage.manual_searches}
                  limit={usageStats.tier.max_manual_searches_per_day}
                />
                <UsageBar
                  label="QA質問（今日）"
                  current={usageStats.daily_usage.qa_questions}
                  limit={usageStats.tier.max_qa_questions_per_day}
                />
              </div>
              <p className="mt-4 text-xs text-gray-500">
                ※ 説明書検索とQA質問の回数は毎日午前4時にリセットされます
              </p>
            </CardBody>
          </Card>
        ) : null}
      </section>

      {/* Profile Settings */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>👤</span>
          <span>プロフィール</span>
        </h2>
        <Card>
          <CardBody>
            {settingsLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : settings ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    表示名
                  </label>
                  {editingDisplayName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayNameInput}
                        onChange={(e) => setDisplayNameInput(e.target.value)}
                        maxLength={20}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="表示名を入力"
                        disabled={saving}
                      />
                      <button
                        onClick={updateDisplayName}
                        disabled={saving}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                      <button
                        onClick={cancelEditingDisplayName}
                        disabled={saving}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900">{settings.display_name}</span>
                      <button
                        onClick={startEditingDisplayName}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        編集
                      </button>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    グループで家電を共有する際に表示されます
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                プロフィールの読み込みに失敗しました
              </p>
            )}
          </CardBody>
        </Card>
      </section>

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

      {/* Help */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span>📚</span>
          <span>サポート</span>
        </h2>
        <Card>
          <CardBody>
            <a
              href="/help"
              className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors"
            >
              <svg
                className="w-6 h-6 text-blue-600"
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
              <div>
                <div className="font-semibold text-gray-900">使い方ガイド</div>
                <div className="text-sm text-gray-600">
                  アプリの使い方やよくある質問を確認
                </div>
              </div>
              <svg
                className="w-5 h-5 ml-auto text-gray-400"
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
            </a>
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
