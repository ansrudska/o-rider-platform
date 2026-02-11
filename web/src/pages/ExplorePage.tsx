import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useCollection } from "../hooks/useFirestore";

interface SegmentData {
  id: string;
  name: string;
  distance: number;
  averageGrade: number;
  maximumGrade: number;
  elevationHigh: number;
  elevationLow: number;
  climbCategory: number; // Strava: 0=NC, 1=Cat4, 2=Cat3, 3=Cat2, 4=Cat1, 5=HC
  city?: string;
  state?: string;
  source?: string;
}

type Category = "all" | "climb" | "flat";

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "all", label: "전체", icon: "🗺" },
  { id: "climb", label: "힐클라임", icon: "⛰" },
  { id: "flat", label: "평지", icon: "➡️" },
];

// Strava climbCategory number → display label
const CLIMB_LABELS: Record<number, string> = {
  5: "HC",
  4: "Cat 1",
  3: "Cat 2",
  2: "Cat 3",
  1: "Cat 4",
};

const CLIMB_COLORS: Record<number, string> = {
  5: "bg-red-600 text-white",
  4: "bg-red-500 text-white",
  3: "bg-orange-500 text-white",
  2: "bg-yellow-500 text-white",
  1: "bg-green-500 text-white",
};

function deriveCategory(seg: SegmentData): "climb" | "flat" {
  return seg.climbCategory > 0 ? "climb" : "flat";
}

export default function ExplorePage() {
  const { data: segments, loading } = useCollection<SegmentData>("segments");
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return segments.filter((s) => {
      if (category !== "all" && deriveCategory(s) !== category) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [segments, category, search]);

  // Sort by elevation gain (descending) as a proxy for popularity
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          (b.elevationHigh - b.elevationLow) -
          (a.elevationHigh - a.elevationLow),
      ),
    [filtered],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">세그먼트 탐색</h1>
        <p className="text-gray-500 text-sm mt-1">
          세그먼트를 찾아보고 도전해보세요
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="세그먼트 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors whitespace-nowrap ${
                category === cat.id
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Segment list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {segments.length === 0
            ? "세그먼트가 없습니다. 활동을 복사하면 세그먼트가 자동으로 추가됩니다."
            : "조건에 맞는 세그먼트가 없습니다."}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            세그먼트 ({sorted.length})
          </h2>
          <div className="space-y-3">
            {sorted.map((segment) => (
              <SegmentCard key={segment.id} segment={segment} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentCard({ segment }: { segment: SegmentData }) {
  const elevGain = Math.max(0, segment.elevationHigh - segment.elevationLow);
  const isClimb = segment.climbCategory > 0;
  const climbLabel = CLIMB_LABELS[segment.climbCategory];
  const climbColor = CLIMB_COLORS[segment.climbCategory];

  return (
    <Link
      to={`/segment/${segment.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{segment.name}</h3>
            {climbLabel && climbColor && (
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${climbColor}`}>
                {climbLabel}
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-xs rounded ${
                isClimb
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {isClimb ? "힐클라임" : "평지"}
            </span>
          </div>
          {(segment.city || segment.state) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {[segment.city, segment.state].filter(Boolean).join(", ")}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>📏 {(segment.distance / 1000).toFixed(2)}km</span>
            <span>⛰ {Math.round(elevGain)}m</span>
            <span>📐 {segment.averageGrade.toFixed(1)}%</span>
            {segment.maximumGrade > 0 && (
              <span>📐 최대 {segment.maximumGrade.toFixed(1)}%</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
