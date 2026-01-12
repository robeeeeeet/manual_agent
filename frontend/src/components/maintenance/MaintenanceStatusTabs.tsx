"use client";

import type { MaintenanceCounts, MaintenanceStatus } from "@/types/appliance";

type TabStatus = MaintenanceStatus | "all";

interface MaintenanceStatusTabsProps {
  activeTab: TabStatus;
  counts: MaintenanceCounts;
  onTabChange: (tab: TabStatus) => void;
}

// 短縮ラベル（モバイル対応）
const tabs: { key: TabStatus; label: string; color: string }[] = [
  { key: "all", label: "すべて", color: "#007AFF" },
  { key: "overdue", label: "超過", color: "#FF3B30" },
  { key: "upcoming", label: "今週", color: "#FF9500" },
  { key: "scheduled", label: "予定", color: "#34C759" },
  { key: "manual", label: "手動", color: "#8E8E93" },
];

function getCount(counts: MaintenanceCounts, key: TabStatus): number {
  if (key === "all") return counts.total;
  return counts[key];
}

export default function MaintenanceStatusTabs({
  activeTab,
  counts,
  onTabChange,
}: MaintenanceStatusTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mb-2 scrollbar-hide">
      {tabs.map((tab) => {
        const count = getCount(counts, tab.key);
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap ${
              isActive
                ? "text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
            style={{
              backgroundColor: isActive ? tab.color : undefined,
            }}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export type { TabStatus };
