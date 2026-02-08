import { useParams } from "react-router-dom";
import StatCard from "../components/StatCard";
import ActivityCard from "../components/ActivityCard";
import WeeklyChart from "../components/WeeklyChart";
import Avatar from "../components/Avatar";
import {
  riders,
  getActivitiesForUser,
  getWeeklyStats,
  segmentEfforts,
  segmentMap,
} from "../data/demo";

function formatHours(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function AthletePage() {
  const { userId } = useParams<{ userId: string }>();
  const rider = riders.find((r) => r.id === userId);
  const userActivities = getActivitiesForUser(userId ?? "");
  const weeklyStats = getWeeklyStats(userId ?? "");

  if (!rider) {
    return (
      <div className="text-center py-12 text-gray-500">
        사용자를 찾을 수 없습니다.
      </div>
    );
  }

  const totalDistance = userActivities.reduce(
    (s, a) => s + a.summary.distance,
    0,
  );
  const totalTime = userActivities.reduce(
    (s, a) => s + a.summary.ridingTimeMillis,
    0,
  );
  const totalElevation = userActivities.reduce(
    (s, a) => s + a.summary.elevationGain,
    0,
  );

  // User PRs - best efforts per segment
  const userEfforts = segmentEfforts.filter((e) => e.userId === userId);
  const prs: { segmentId: string; segmentName: string; time: number; rank: number | null }[] = [];
  for (const effort of userEfforts) {
    const segId = findSegmentForEffort(effort.id);
    if (segId) {
      const seg = segmentMap[segId];
      if (seg && !prs.some((p) => p.segmentId === segId)) {
        prs.push({
          segmentId: segId,
          segmentName: seg.name,
          time: effort.elapsedTime,
          rank: effort.rank,
        });
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Cover + Profile */}
      <div className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-lg h-36 relative">
        <div className="absolute -bottom-10 left-6 flex items-end gap-4">
          <div className="ring-4 ring-white rounded-full bg-white">
            <Avatar name={rider.nickname} size="xl" />
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="pt-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{rider.nickname}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{rider.bio}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>📍 {rider.location}</span>
            <span>
              <strong className="text-gray-700">{rider.followers}</strong>{" "}
              팔로워
            </span>
            <span>
              <strong className="text-gray-700">{rider.following}</strong>{" "}
              팔로잉
            </span>
          </div>
        </div>
        <button className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
          팔로우
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="총 활동"
          value={`${userActivities.length}회`}
          icon="🚴"
        />
        <StatCard
          label="총 거리"
          value={`${(totalDistance / 1000).toFixed(0)} km`}
          icon="📏"
        />
        <StatCard
          label="총 시간"
          value={formatHours(totalTime)}
          icon="⏱"
        />
        <StatCard
          label="총 획득고도"
          value={`${totalElevation.toLocaleString()} m`}
          icon="⛰"
        />
      </div>

      {/* Weekly chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          주간 활동 (최근 12주)
        </h3>
        <WeeklyChart data={weeklyStats} dataKey="distance" height={160} />
      </div>

      {/* PRs */}
      {prs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
            개인 기록 (PR)
          </div>
          <div className="divide-y divide-gray-100">
            {prs.map((pr) => (
              <a
                key={pr.segmentId}
                href={`/segment/${pr.segmentId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{pr.segmentName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {pr.rank === 1 ? "🏆 KOM" : `#${pr.rank}`}
                  </div>
                </div>
                <div className="font-mono font-semibold">
                  {formatTime(pr.time)}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div>
        <h2 className="text-lg font-semibold mb-3">최근 활동</h2>
        <div className="space-y-4">
          {userActivities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              아직 활동이 없습니다.
            </p>
          ) : (
            userActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                showMap={false}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to find which segment an effort belongs to
const SEGMENT_EFFORT_MAP: Record<string, string[]> = {
  seg_namsan: ["eff_01", "eff_02", "eff_03", "eff_04"],
  seg_bukak: ["eff_05", "eff_06", "eff_07", "eff_08"],
  seg_hangang: ["eff_09", "eff_10", "eff_11", "eff_12"],
  seg_paldang: ["eff_13", "eff_14", "eff_15", "eff_16"],
  seg_bukansan: ["eff_17", "eff_18", "eff_19", "eff_20"],
};

function findSegmentForEffort(effortId: string): string | undefined {
  for (const [segId, ids] of Object.entries(SEGMENT_EFFORT_MAP)) {
    if (ids.includes(effortId)) return segId;
  }
  return undefined;
}
