interface StatCardProps {
  label: string;
  value: string;
  icon?: string;
  color?: string;
  subValue?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  color = "text-gray-900 dark:text-gray-50",
  subValue,
}: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
      </div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      {subValue && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}
