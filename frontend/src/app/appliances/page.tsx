"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { UserApplianceWithDetails } from "@/types/appliance";

export default function AppliancesPage() {
  const { user, loading: authLoading } = useAuth();
  const [appliances, setAppliances] = useState<UserApplianceWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAppliances = async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/appliances");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "家電データの取得に失敗しました");
      }

      const data = await response.json();
      setAppliances(data);
    } catch (err) {
      console.error("Error fetching appliances:", err);
      setError(
        err instanceof Error ? err.message : "家電データの取得に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchAppliances();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
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
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchAppliances}>再読み込み</Button>
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
                    <span className="text-xs text-gray-400">
                      {formatDate(appliance.created_at)} 登録
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
