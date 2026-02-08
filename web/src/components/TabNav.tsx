interface TabNavProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function TabNav({ tabs, activeTab, onChange }: TabNavProps) {
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === tab.id
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
