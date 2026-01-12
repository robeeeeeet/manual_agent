"use client";

interface MaintenanceFilterProps {
  importance: "all" | "high" | "medium" | "low";
  maker: string | null;
  makers: string[];
  onImportanceChange: (value: "all" | "high" | "medium" | "low") => void;
  onMakerChange: (maker: string | null) => void;
}

export default function MaintenanceFilter({
  importance,
  maker,
  makers,
  onImportanceChange,
  onMakerChange,
}: MaintenanceFilterProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center">
      {/* Importance filter */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="importance-filter"
          className="text-sm font-medium text-gray-700"
        >
          重要度:
        </label>
        <select
          id="importance-filter"
          value={importance}
          onChange={(e) =>
            onImportanceChange(
              e.target.value as "all" | "high" | "medium" | "low"
            )
          }
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="all">すべて</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </select>
      </div>

      {/* Maker filter */}
      {makers.length > 0 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="maker-filter"
            className="text-sm font-medium text-gray-700"
          >
            メーカー:
          </label>
          <select
            id="maker-filter"
            value={maker || "all"}
            onChange={(e) =>
              onMakerChange(e.target.value === "all" ? null : e.target.value)
            }
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white max-w-[200px]"
          >
            <option value="all">すべて</option>
            {makers.map((makerName) => (
              <option key={makerName} value={makerName}>
                {makerName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
