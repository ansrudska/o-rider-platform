import { useState } from "react";
import { useParams } from "react-router-dom";
import MapPlaceholder from "../components/MapPlaceholder";
import ElevationChart from "../components/ElevationChart";
import LeaderboardTable from "../components/LeaderboardTable";
import StatCard from "../components/StatCard";
import { segments, getEffortsForSegment, generateElevationProfile } from "../data/demo";

const CURRENT_USER = "rider_1";

const CATEGORY_COLORS: Record<string, string> = {
  HC: "bg-red-600 text-white",
  "1": "bg-red-500 text-white",
  "2": "bg-orange-500 text-white",
  "3": "bg-yellow-500 text-white",
  "4": "bg-green-500 text-white",
};

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SegmentPage() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const [filter, setFilter] = useState<"all" | "friends" | "week" | "month">("all");

  const segment = segments.find((s) => s.id === segmentId);
  const efforts = getEffortsForSegment(segmentId ?? "");

  if (!segment) {
    return (
      <div className="text-center py-12 text-gray-500">
        세그먼트를 찾을 수 없습니다.
      </div>
    );
  }

  const elevProfile = generateElevationProfile(
    segment.distance,
    segment.elevationGain,
    30,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{segment.name}</h1>
          {segment.climbCategory && (
            <span
              className={`px-2.5 py-1 text-xs font-bold rounded ${CATEGORY_COLORS[segment.climbCategory] ?? "bg-gray-200"}`}
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
        <p className="text-gray-500 mt-1 text-sm">{segment.description}</p>
      </div>

      {/* Map */}
      <MapPlaceholder height="h-56" label="세그먼트 경로" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="거리"
          value={`${(segment.distance / 1000).toFixed(2)} km`}
          icon="📏"
        />
        <StatCard
          label="획득고도"
          value={`${segment.elevationGain} m`}
          icon="⛰"
        />
        <StatCard
          label="평균경사"
          value={`${segment.averageGrade.toFixed(1)}%`}
          icon="📐"
        />
        <StatCard
          label="총 도전"
          value={`${segment.totalEfforts.toLocaleString()}회`}
          icon="🏁"
        />
      </div>

      {/* KOM / QOM */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <span>👑</span> KOM
          </div>
          {segment.kom ? (
            <>
              <div className="text-2xl font-bold mt-1 text-orange-600">
                {formatTime(segment.kom.time)}
              </div>
              <div className="text-sm text-gray-600">{segment.kom.nickname}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(segment.kom.recordedAt).toLocaleDateString("ko-KR")}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">기록 없음</div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <span>👑</span> QOM
          </div>
          {segment.qom ? (
            <>
              <div className="text-2xl font-bold mt-1 text-pink-600">
                {formatTime(segment.qom.time)}
              </div>
              <div className="text-sm text-gray-600">{segment.qom.nickname}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(segment.qom.recordedAt).toLocaleDateString("ko-KR")}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 mt-1">기록 없음</div>
          )}
        </div>
      </div>

      {/* Elevation profile */}
      {segment.category === "climb" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            고도 프로파일
          </h3>
          <ElevationChart data={elevProfile} height={160} />
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">리더보드</h2>
          <div className="flex gap-1">
            {(
              [
                { id: "all", label: "전체" },
                { id: "friends", label: "친구" },
                { id: "week", label: "이번 주" },
                { id: "month", label: "이번 달" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filter === f.id
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <LeaderboardTable
          efforts={efforts}
          highlightUserId={CURRENT_USER}
        />
      </div>
    </div>
  );
}
