import { Link } from "react-router-dom";
import ActivityCard from "../components/ActivityCard";
import StatCard from "../components/StatCard";
import WeeklyChart from "../components/WeeklyChart";
import { useAuth } from "../contexts/AuthContext";
import { useActivities, useWeeklyStats } from "../hooks/useActivities";

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

  const displayName = profile?.nickname ?? user?.displayName ?? "라이더";
  const displayInitial = displayName.charAt(0);
  const profileLink = user ? `/athlete/${user.uid}` : "#";

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
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-48" />
                  </div>
                </div>
                <div className="h-48 bg-gray-200 rounded mb-3" />
                <div className="flex gap-6">
                  <div className="h-3 bg-gray-200 rounded w-20" />
                  <div className="h-3 bg-gray-200 rounded w-20" />
                  <div className="h-3 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🚴</div>
            <p className="text-gray-500 mb-2">아직 활동이 없습니다.</p>
            {user && !profile?.stravaConnected && (
              <Link to="/settings" className="text-orange-600 hover:underline text-sm font-medium">
                Strava를 연동하여 활동을 가져오세요 →
              </Link>
            )}
            {!user && (
              <p className="text-sm text-gray-400">로그인하고 Strava를 연동하면 라이딩 기록이 표시됩니다.</p>
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
          <Link to={profileLink} className="flex items-center gap-3">
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
                {user ? user.email : "데모 사용자"}
              </div>
            </div>
          </Link>
          {user && profile?.stravaConnected && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
              <svg className="w-3.5 h-3.5 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Strava 연동됨
              {profile.stravaNickname && <span className="text-gray-400">· {profile.stravaNickname}</span>}
            </div>
          )}
        </div>

        {/* This week summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">이번 주 요약</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="라이딩" value={`${thisWeek.rides}회`} />
            <StatCard label="거리" value={`${(thisWeek.distance / 1000).toFixed(0)}km`} />
            <StatCard label="시간" value={formatDuration(thisWeek.time)} />
            <StatCard label="획득고도" value={`${thisWeek.elevation}m`} />
          </div>
        </div>

        {/* Weekly distance chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">주간 거리 (최근 12주)</h3>
          <WeeklyChart data={weeklyStats} dataKey="distance" height={140} />
        </div>

        {/* Quick links */}
        {user && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">바로가기</h3>
            <div className="space-y-2">
              <Link to="/settings" className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 transition-colors py-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                설정
              </Link>
              {!profile?.stravaConnected && (
                <Link to="/settings" className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 transition-colors py-1 font-medium">
                  <svg className="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  Strava 연동하기
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
