"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import ShareToggle from "@/components/appliance/ShareButton";
import { useAppliances } from "@/hooks/useAppliances";

export default function AppliancesPage() {
  const { user, loading: authLoading } = useAuth();
  const { appliances, isLoading, error, refetch } = useAppliances();
  const [hasGroup, setHasGroup] = useState(false);

  // Check if user is in a group
  useEffect(() => {
    if (authLoading || !user) return;

    const checkGroupMembership = async () => {
      try {
        const response = await fetch("/api/groups");
        if (response.ok) {
          const data = await response.json();
          // API returns { groups: [...], count: number }
          const groups = data.groups || data;
          setHasGroup(Array.isArray(groups) && groups.length > 0);
        }
      } catch (err) {
        console.error("Error checking group membership:", err);
      }
    };

    checkGroupMembership();
  }, [user, authLoading]);

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get maintenance badge styling based on days until due
  const getMaintenanceBadgeStyle = (daysUntilDue: number) => {
    if (daysUntilDue < 0) {
      // Overdue
      return {
        bg: "bg-red-100",
        text: "text-red-700",
        icon: "⚠️",
      };
    } else if (daysUntilDue <= 7) {
      // Due soon (within 7 days)
      return {
        bg: "bg-amber-100",
        text: "text-amber-700",
        icon: "⚠️",
      };
    } else {
      // Not urgent
      return {
        bg: "bg-green-100",
        text: "text-green-700",
        icon: "✓",
      };
    }
  };

  // Format maintenance due text
  const formatMaintenanceDue = (daysUntilDue: number): string => {
    if (daysUntilDue < 0) {
      return `${Math.abs(daysUntilDue)}日超過`;
    } else if (daysUntilDue === 0) {
      return "今日";
    } else if (daysUntilDue === 1) {
      return "明日";
    } else {
      return `${daysUntilDue}日後`;
    }
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
          登録した家電を表示するにはログインしてください。
        </p>
        <Link href="/login">
          <Button>ログイン</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">登録した家電</h1>
          <p className="text-gray-600 mt-1">
            {appliances.length}件の家電が登録されています
          </p>
        </div>
        <Link href="/register">
          <Button>
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
            家電を追加
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error.message}</p>
              <Button onClick={() => refetch()}>再読み込み</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {!isLoading && !error && appliances.length === 0 && (
        <Card>
          <CardBody>
            <div className="text-center py-12">
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
              <h2 className="text-lg font-medium text-gray-900 mb-2">
                まだ家電が登録されていません
              </h2>
              <p className="text-gray-600 mb-6">
                写真を撮影するだけで簡単に登録できます
              </p>
              <Link href="/register">
                <Button>最初の家電を登録する</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {!isLoading && !error && appliances.length > 0 && (
        <div className="space-y-4">
          {appliances.map((appliance) => (
            <Link key={appliance.id} href={`/appliances/${appliance.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-gray-900">
                          {appliance.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600">
                          {appliance.category}
                        </span>
                        {appliance.is_group_owned && appliance.group_name && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 flex items-center gap-1">
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
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                            {appliance.group_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {appliance.maker} {appliance.model_number}
                      </p>

                      {/* Next maintenance info */}
                      {appliance.next_maintenance ? (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${
                            getMaintenanceBadgeStyle(
                              appliance.next_maintenance.days_until_due
                            ).bg
                          } ${
                            getMaintenanceBadgeStyle(
                              appliance.next_maintenance.days_until_due
                            ).text
                          }`}
                        >
                          <span>
                            {
                              getMaintenanceBadgeStyle(
                                appliance.next_maintenance.days_until_due
                              ).icon
                            }
                          </span>
                          <span>
                            次回メンテ:{" "}
                            {formatMaintenanceDue(
                              appliance.next_maintenance.days_until_due
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          メンテナンス未設定
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {/* Share toggle */}
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <ShareToggle
                          applianceId={appliance.id}
                          isGroupOwned={appliance.is_group_owned}
                          hasGroup={hasGroup}
                          isOriginalOwner={appliance.user_id === user?.id}
                          onShareChange={() => refetch()}
                        />
                      </div>
                      {appliance.manual_source_url && (
                        <span
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(appliance.manual_source_url!, "_blank");
                          }}
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
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {formatDate(appliance.created_at)} 登録
                      </span>
                      <svg
                        className="w-5 h-5 text-gray-400"
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
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
