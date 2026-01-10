"use client";

import type { MaintenanceCounts, MaintenanceStatus } from "@/types/appliance";

type TabStatus = MaintenanceStatus | "all";

interface MaintenanceStatusTabsProps {
  activeTab: TabStatus;
  counts: MaintenanceCounts;
  onTabChange: (tab: TabStatus) => void;
}

const tabs: { key: TabStatus; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "overdue", label: "期限超過" },
  { key: "upcoming", label: "今週" },
  { key: "scheduled", label: "予定通り" },
  { key: "manual", label: "手動" },
];

function getCount(counts: MaintenanceCounts, key: TabStatus): number {
  if (key === "all") return counts.total;
  return counts[key];
}

function getTabStyle(isActive: boolean, key: TabStatus): string {
  const base =
    "px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap";

  if (isActive) {
    if (key === "overdue") {
      return `${base} bg-red-100 text-red-700`;
    }
    return `${base} bg-blue-100 text-blue-700`;
  }

  return `${base} text-gray-600 hover:text-gray-900 hover:bg-gray-100`;
}

function getBadgeStyle(isActive: boolean, key: TabStatus): string {
  const base = "ml-1.5 px-1.5 py-0.5 text-xs rounded-full";

  if (isActive) {
    if (key === "overdue") {
      return `${base} bg-red-200 text-red-800`;
    }
    return `${base} bg-blue-200 text-blue-800`;
  }

  if (key === "overdue") {
    return `${base} bg-red-100 text-red-600`;
  }

  return `${base} bg-gray-200 text-gray-600`;
}

export default function MaintenanceStatusTabs({
  activeTab,
  counts,
  onTabChange,
}: MaintenanceStatusTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mb-2">
      {tabs.map((tab) => {
        const count = getCount(counts, tab.key);
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={getTabStyle(isActive, tab.key)}
          >
            {tab.label}
            <span className={getBadgeStyle(isActive, tab.key)}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export type { TabStatus };
