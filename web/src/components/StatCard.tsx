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
  color = "text-gray-900",
  subValue,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      {subValue && (
        <div className="text-xs text-gray-400 mt-0.5">{subValue}</div>
      )}
    </div>
  );
}
