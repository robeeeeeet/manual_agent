"use client";

import type { MaintenanceWithAppliance } from "@/types/appliance";

interface MaintenanceListItemProps {
  item: MaintenanceWithAppliance;
  onComplete: (item: MaintenanceWithAppliance) => void;
  onItemClick?: (item: MaintenanceWithAppliance) => void;
  showApplianceName?: boolean;
  compact?: boolean;
}

const importanceConfig = {
  high: { label: "高", bg: "bg-[#FF3B30]/10", text: "text-[#FF3B30]" },
  medium: { label: "中", bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" },
  low: { label: "低", bg: "bg-[#34C759]/10", text: "text-[#34C759]" },
};

function getStatusConfig(daysUntilDue: number | null, status: string) {
  if (status === "manual") {
    return { label: "手動", bg: "bg-gray-100", text: "text-gray-600" };
  }
  if (daysUntilDue === null) {
    return { label: "-", bg: "bg-gray-100", text: "text-gray-600" };
  }
  if (daysUntilDue < 0) {
    return {
      label: `${Math.abs(daysUntilDue)}日超過`,
      bg: "bg-[#FF3B30]/10",
      text: "text-[#FF3B30]",
    };
  }
  if (daysUntilDue === 0) {
    return { label: "今日", bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" };
  }
  if (daysUntilDue === 1) {
    return { label: "明日", bg: "bg-[#FF9500]/10", text: "text-[#FF9500]" };
  }
  if (daysUntilDue <= 7) {
    return {
      label: `${daysUntilDue}日後`,
      bg: "bg-[#FF9500]/10",
      text: "text-[#FF9500]",
    };
  }
  return {
    label: `${daysUntilDue}日後`,
    bg: "bg-[#34C759]/10",
    text: "text-[#34C759]",
  };
}

export default function MaintenanceListItem({
  item,
  onComplete,
  onItemClick,
  showApplianceName = true,
  compact = false,
}: MaintenanceListItemProps) {
  const statusConfig = getStatusConfig(item.days_until_due, item.status);
  const impConfig = importanceConfig[item.importance];

  if (compact) {
    // コンパクト版（ホームページ用）- iOS風リストスタイル
    return (
      <div
        onClick={() => onItemClick?.(item)}
        className={`flex items-center gap-3 ${onItemClick ? "cursor-pointer" : ""}`}
      >
        {/* 左側：コンテンツ */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate" title={item.task_name}>
            {item.task_name}
          </p>
          {showApplianceName && (
            <p className="text-sm text-gray-500 truncate">
              {item.appliance_name}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${impConfig.bg} ${impConfig.text}`}>
              {impConfig.label}
            </span>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* 右側：完了ボタン */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete(item);
          }}
          className={`w-16 py-2 text-sm font-semibold rounded-xl transition-colors ${
            item.days_until_due !== null && item.days_until_due < 0
              ? "bg-[#FF3B30] text-white hover:bg-[#E5342B]"
              : "bg-[#007AFF] text-white hover:bg-[#0066DD]"
          }`}
        >
          完了
        </button>
      </div>
    );
  }

  // フルバージョン（メンテナンス一覧ページ用）- iOS風
  return (
    <div
      onClick={() => onItemClick?.(item)}
      className={`bg-white rounded-xl p-4 shadow-sm transition-colors ${
        onItemClick ? "hover:bg-gray-50 active:bg-gray-100 cursor-pointer" : ""
      }`}
    >
      {/* タスク名 */}
      <h4 className="font-semibold text-gray-900 mb-1" title={item.task_name}>
        {item.task_name}
      </h4>

      {/* 家電名 */}
      {showApplianceName && (
        <p className="text-sm text-gray-500 mb-3">
          {item.appliance_name} • {item.maker}
        </p>
      )}

      {/* バッジと完了ボタン */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${impConfig.bg} ${impConfig.text}`}>
            {impConfig.label}
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
            {statusConfig.label}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete(item);
          }}
          className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
            item.days_until_due !== null && item.days_until_due < 0
              ? "bg-[#FF3B30] text-white hover:bg-[#E5342B]"
              : "bg-[#007AFF] text-white hover:bg-[#0066DD]"
          }`}
        >
          完了
        </button>
      </div>
    </div>
  );
}
