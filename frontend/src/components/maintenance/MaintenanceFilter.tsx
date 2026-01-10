"use client";

interface Appliance {
  id: string;
  name: string;
}

interface MaintenanceFilterProps {
  importance: "all" | "high" | "medium" | "low";
  applianceId: string | null;
  appliances: Appliance[];
  onImportanceChange: (value: "all" | "high" | "medium" | "low") => void;
  onApplianceChange: (applianceId: string | null) => void;
}

export default function MaintenanceFilter({
  importance,
  applianceId,
  appliances,
  onImportanceChange,
  onApplianceChange,
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

      {/* Appliance filter */}
      {appliances.length > 0 && (
        <div className="flex items-center gap-2">
          <label
            htmlFor="appliance-filter"
            className="text-sm font-medium text-gray-700"
          >
            家電:
          </label>
          <select
            id="appliance-filter"
            value={applianceId || "all"}
            onChange={(e) =>
              onApplianceChange(e.target.value === "all" ? null : e.target.value)
            }
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white max-w-[200px]"
          >
            <option value="all">すべて</option>
            {appliances.map((appliance) => (
              <option key={appliance.id} value={appliance.id}>
                {appliance.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
