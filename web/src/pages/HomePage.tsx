import { Link } from "react-router-dom";
import ActivityCard from "../components/ActivityCard";
import StatCard from "../components/StatCard";
import WeeklyChart from "../components/WeeklyChart";
import { useAuth } from "../contexts/AuthContext";
import { useActivities, useWeeklyStats } from "../hooks/useActivities";
import { segments, riderMap } from "../data/demo";

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const { activities, loading, isDemo } = useActivities();
  const { weeklyStats, thisWeek } = useWeeklyStats();
  const feed = [...activities].sort((a, b) => b.createdAt - a.createdAt);

  const displayName = profile?.nickname ?? user?.displayName ?? riderMap["rider_1"]!.nickname;
  const displayInitial = displayName.charAt(0);
  const profileLink = user ? `/athlete/${user.uid}` : "/athlete/rider_1";

  return (
    <div className="flex gap-6">
      {/* Left: Activity Feed */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">활동 피드</h2>
          {isDemo && (
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
              데모 모드
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            <p className="mb-2">아직 활동이 없습니다.</p>
            {user && !profile?.stravaConnected && (
              <Link to="/settings" className="text-orange-600 hover:underline text-sm">
                Strava를 연동하여 활동을 가져오세요
              </Link>
            )}
          </div>
        ) : (
          feed.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))
        )}
      </div>

      {/* Right: Sidebar */}
      <div className="hidden lg:block w-80 flex-shrink-0 space-y-5">
        {/* Profile summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <Link
            to={profileLink}
            className="flex items-center gap-3"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-lg font-bold text-orange-600">
                {displayInitial}
              </div>
            )}
            <div>
              <div className="font-semibold text-sm">{displayName}</div>
              <div className="text-xs text-gray-500">
                {isDemo ? "서울 강남" : user?.email}
              </div>
            </div>
          </Link>
        </div>

        {/* This week summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            이번 주 요약
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="라이딩"
              value={`${thisWeek.rides}회`}
              icon="🚴"
            />
            <StatCard
              label="거리"
              value={`${(thisWeek.distance / 1000).toFixed(0)}km`}
              icon="📏"
            />
            <StatCard
              label="시간"
              value={formatDuration(thisWeek.time)}
              icon="⏱"
            />
            <StatCard
              label="획득고도"
              value={`${thisWeek.elevation}m`}
              icon="⛰"
            />
          </div>
        </div>

        {/* Weekly chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            주간 거리 (최근 12주)
          </h3>
          <WeeklyChart data={weeklyStats} dataKey="distance" height={140} />
        </div>

        {/* Popular segments (demo only) */}
        {isDemo && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              인기 세그먼트
            </h3>
            <div className="space-y-2">
              {segments.slice(0, 4).map((seg) => (
                <Link
                  key={seg.id}
                  to={`/segment/${seg.id}`}
                  className="flex items-center justify-between py-1.5 hover:text-orange-600 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-xs">
                      {seg.category === "climb"
                        ? "⛰"
                        : seg.category === "sprint"
                          ? "⚡"
                          : "➡️"}
                    </span>
                    <span className="font-medium">{seg.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {seg.totalEfforts}회
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
