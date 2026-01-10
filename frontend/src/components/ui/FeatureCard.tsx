import { ReactNode } from "react";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  iconBgColor?: string;
  iconColor?: string;
}

export default function FeatureCard({
  icon,
  title,
  description,
  iconBgColor = "bg-blue-50",
  iconColor = "text-blue-600",
}: FeatureCardProps) {
  return (
    <div className="flex flex-col items-center text-center p-4">
      <div
        className={`w-10 h-10 ${iconBgColor} rounded-full flex items-center justify-center mb-3`}
      >
        <div className={`w-5 h-5 ${iconColor}`}>{icon}</div>
      </div>
      <h3 className="font-medium text-gray-800 text-sm mb-1">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
