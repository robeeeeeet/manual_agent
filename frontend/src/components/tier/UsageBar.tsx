interface UsageBarProps {
  label: string;
  current: number;
  limit: number;
}

export default function UsageBar({ label, current, limit }: UsageBarProps) {
  const isUnlimited = limit === -1;
  const percentage = isUnlimited ? 0 : (current / limit) * 100;
  const isNearLimit = percentage >= 80;
  const isAtLimit = current >= limit;

  // Color logic: blue (normal) → yellow (warning >= 80%) → red (at limit)
  const getBarColor = () => {
    if (isUnlimited) return "bg-gray-300";
    if (isAtLimit) return "bg-red-500";
    if (isNearLimit) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getTextColor = () => {
    if (isUnlimited) return "text-gray-600";
    if (isAtLimit) return "text-red-600";
    if (isNearLimit) return "text-yellow-600";
    return "text-blue-600";
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-semibold ${getTextColor()}`}>
          {isUnlimited ? (
            "無制限"
          ) : (
            <>
              {current} / {limit}
            </>
          )}
        </span>
      </div>
      {!isUnlimited && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
