import { useState } from "react";
import { Link } from "react-router-dom";
import { segments } from "../data/demo";
import type { Segment } from "@shared/types";

type Category = "all" | "climb" | "sprint" | "flat";

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "all", label: "전체", icon: "🗺" },
  { id: "climb", label: "힐클라임", icon: "⛰" },
  { id: "sprint", label: "스프린트", icon: "⚡" },
  { id: "flat", label: "평지", icon: "➡️" },
];

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const CLIMB_CATEGORY_COLORS: Record<string, string> = {
  HC: "bg-red-600 text-white",
  "1": "bg-red-500 text-white",
  "2": "bg-orange-500 text-white",
  "3": "bg-yellow-500 text-white",
  "4": "bg-green-500 text-white",
};

export default function ExplorePage() {
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");

  const filtered = segments.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  // Sort by popularity
  const sorted = [...filtered].sort(
    (a, b) => b.totalEfforts - a.totalEfforts,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">세그먼트 탐색</h1>
        <p className="text-gray-500 text-sm mt-1">
          인기 세그먼트를 찾아보고 도전해보세요
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

      {/* Top segments */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          인기 세그먼트 Top {sorted.length}
        </h2>
        <div className="space-y-3">
          {sorted.map((segment, index) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              rank={index + 1}
            />
          ))}
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          조건에 맞는 세그먼트가 없습니다.
        </div>
      )}
    </div>
  );
}

function SegmentCard({
  segment,
  rank,
}: {
  segment: Segment;
  rank: number;
}) {
  return (
    <Link
      to={`/segment/${segment.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-colors"
    >
      <div className="flex items-start gap-4">
        {/* Rank */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{segment.name}</h3>
            {segment.climbCategory && (
              <span
                className={`px-2 py-0.5 text-xs font-bold rounded ${CLIMB_CATEGORY_COLORS[segment.climbCategory]}`}
              >
                Cat {segment.climbCategory}
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-xs rounded ${
                segment.category === "climb"
                  ? "bg-green-100 text-green-700"
                  : segment.category === "sprint"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-blue-100 text-blue-700"
              }`}
            >
              {segment.category === "climb"
                ? "힐클라임"
                : segment.category === "sprint"
                  ? "스프린트"
                  : "평지"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{segment.description}</p>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>📏 {(segment.distance / 1000).toFixed(2)}km</span>
            <span>⛰ {segment.elevationGain}m</span>
            <span>📐 {segment.averageGrade.toFixed(1)}%</span>
            <span>🏁 {segment.totalEfforts.toLocaleString()}회 도전</span>
          </div>
        </div>

        {/* KOM time */}
        <div className="flex-shrink-0 text-right">
          {segment.kom && (
            <div>
              <div className="text-xs text-gray-500">KOM</div>
              <div className="font-mono font-semibold text-orange-600">
                {formatTime(segment.kom.time)}
              </div>
              <div className="text-xs text-gray-400">
                {segment.kom.nickname}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
