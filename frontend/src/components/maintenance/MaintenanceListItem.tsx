"use client";

import Button from "@/components/ui/Button";
import type { MaintenanceWithAppliance } from "@/types/appliance";

interface MaintenanceListItemProps {
  item: MaintenanceWithAppliance;
  onComplete: (item: MaintenanceWithAppliance) => void;
  onItemClick?: (item: MaintenanceWithAppliance) => void;
  showApplianceName?: boolean;
  compact?: boolean;
}

const importanceLabels = {
  high: "高",
  medium: "中",
  low: "低",
};

const importanceColors = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

function getStatusText(daysUntilDue: number | null, status: string): string {
  if (status === "manual") return "手動";
  if (daysUntilDue === null) return "-";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}日超過`;
  if (daysUntilDue === 0) return "今日";
  if (daysUntilDue === 1) return "明日";
  return `${daysUntilDue}日後`;
}

function getStatusColor(daysUntilDue: number | null, status: string): string {
  if (status === "manual") return "bg-gray-100 text-gray-600";
  if (daysUntilDue === null) return "bg-gray-100 text-gray-600";
  if (daysUntilDue < 0) return "bg-red-100 text-red-700";
  if (daysUntilDue <= 7) return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

export default function MaintenanceListItem({
  item,
  onComplete,
  onItemClick,
  showApplianceName = true,
  compact = false,
}: MaintenanceListItemProps) {
  const handleClick = () => {
    if (onItemClick) {
      onItemClick(item);
    }
  };

  if (compact) {
    // Compact version for top page
    return (
      <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-b-0 gap-3">
        <div className="flex-1 min-w-0">
          <p
            className="font-medium text-gray-900 line-clamp-2"
            title={item.task_name}
          >
            {item.task_name}
          </p>
          {showApplianceName && (
            <p className="text-sm text-gray-500 truncate mt-1" title={item.appliance_name}>
              {item.appliance_name}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${importanceColors[item.importance]}`}
            >
              {importanceLabels[item.importance]}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${getStatusColor(item.days_until_due, item.status)}`}
            >
              {getStatusText(item.days_until_due, item.status)}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onComplete(item)}
            className="whitespace-nowrap"
          >
            完了
          </Button>
        </div>
      </div>
    );
  }

  // Full version for maintenance list page - matching appliance detail page layout
  return (
    <div
      onClick={handleClick}
      className={`p-3 bg-gray-50 rounded-lg border border-gray-100 transition-colors ${
        onItemClick ? "hover:bg-gray-100 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Task name and appliance info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 line-clamp-2" title={item.task_name}>
            {item.task_name}
          </h4>
          {showApplianceName && (
            <p className="text-sm text-gray-500 truncate" title={item.appliance_name}>
              {item.appliance_name}
            </p>
          )}
        </div>

        {/* Right: Badges and complete button */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {/* Importance badge */}
            <span
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${importanceColors[item.importance]}`}
            >
              {importanceLabels[item.importance]}
            </span>

            {/* Due status badge */}
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(item.days_until_due, item.status)}`}
            >
              {getStatusText(item.days_until_due, item.status)}
            </span>
          </div>

          {/* Complete button */}
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onComplete(item);
            }}
            className={
              item.days_until_due !== null && item.days_until_due < 0
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
}
