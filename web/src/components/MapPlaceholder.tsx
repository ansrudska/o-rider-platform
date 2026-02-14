interface MapPlaceholderProps {
  height?: string;
  label?: string;
}

export default function MapPlaceholder({
  height = "h-64",
  label = "지도",
}: MapPlaceholderProps) {
  return (
    <div
      className={`${height} bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 relative overflow-hidden`}
    >
      {/* Fake map grid */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`h${i}`}
            className="absolute w-full border-t border-gray-400 dark:border-gray-600"
            style={{ top: `${(i + 1) * 12}%` }}
          />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={`v${i}`}
            className="absolute h-full border-l border-gray-400 dark:border-gray-600"
            style={{ left: `${(i + 1) * 8}%` }}
          />
        ))}
      </div>
      {/* Fake route */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
      >
        <path
          d="M 30 150 Q 80 50, 150 100 T 250 60 T 370 120"
          fill="none"
          stroke="#f97316"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center gap-1">
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );
}
