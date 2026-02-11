import { Link, useNavigate } from "react-router-dom";
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

const communities = [
  { name: "도싸", desc: "도로자전거싸롱", url: "https://dossa.bike", color: "orange" },
  { name: "자출사", desc: "자전거 출퇴근 커뮤니티", url: "https://cafe.naver.com/bikecity", color: "green" },
  { name: "클리앙 자전거당", desc: "클리앙 자전거 게시판", url: "https://clien.net", color: "blue" },
  { name: "바이크셀", desc: "자전거 중고거래", url: "https://bikesell.co.kr", color: "purple" },
  { name: "더바이크", desc: "자전거 전문 매거진", url: "https://thebike.co.kr", color: "red" },
] as const;

const communityColors: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-100", text: "text-orange-600" },
  green: { bg: "bg-green-100", text: "text-green-600" },
  blue: { bg: "bg-blue-100", text: "text-blue-600" },
  purple: { bg: "bg-purple-100", text: "text-purple-600" },
  red: { bg: "bg-red-100", text: "text-red-600" },
};

const communityIcons: Record<string, string> = {
  "도싸": "🚴",
  "자출사": "🏙️",
  "클리앙 자전거당": "💬",
  "바이크셀": "🔄",
  "더바이크": "📰",
};

function CommunityCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">한국 자전거 커뮤니티</h3>
      <div className="space-y-1">
        {communities.map((c) => {
          const colors = communityColors[c.color]!;
          return (
            <a
              key={c.name}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center text-sm`}>
                {communityIcons[c.name]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{c.name}</div>
                <div className="text-xs text-gray-400">{c.desc}</div>
              </div>
              <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user, profile, signInWithGoogle } = useAuth();
  const { activities, totalCount, loading, loadMore, hasMore } = useActivities();
  const { weeklyStats, thisWeek } = useWeeklyStats();
  const navigate = useNavigate();
  const feed = [...activities].sort((a, b) => b.createdAt - a.createdAt);

  const isLoggedIn = !!user;
  const stravaConnected = !!profile?.stravaConnected;

  // Compute stats from loaded activities
  const totalDistance = Math.round(
    activities.reduce((sum, a) => sum + (a.summary?.distance ?? 0), 0) / 1000,
  );

  // Show hero banner for: not logged in (large) or logged in without Strava (medium)
  const showHero = !isLoggedIn || !stravaConnected;

  return (
    <div>
      {/* Hero Banner */}
      {showHero && (
        <div className="mb-6 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 text-white p-6 sm:p-8 relative overflow-hidden">
          {/* Background decoration */}
          <svg className="absolute right-0 top-0 h-full w-1/3 opacity-10" viewBox="0 0 200 200" fill="currentColor">
            <circle cx="140" cy="140" r="50" />
            <circle cx="140" cy="140" r="42" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="60" cy="140" r="50" />
            <circle cx="60" cy="140" r="42" fill="none" stroke="currentColor" strokeWidth="4" />
            <path d="M60 90 L100 30 L140 90" strokeWidth="6" fill="none" stroke="currentColor" />
            <path d="M80 90 L100 55 L120 90" strokeWidth="4" fill="none" stroke="currentColor" />
          </svg>

          <div className="relative">
            <h1 className="text-xl sm:text-2xl font-bold">
              한국 라이더들의 기록을 안전하게
            </h1>
            <p className="text-orange-100 mt-1 text-sm">
              {isLoggedIn
                ? "Strava를 연동하면 라이딩 기록을 자동으로 가져옵니다."
                : "소중한 라이딩 기록을 O-Rider에 보관하고, 한국의 자전거 커뮤니티와 함께하세요."}
            </p>

            {/* Stats */}
            {totalCount > 0 && (
              <div className="flex gap-6 mt-4 text-sm">
                <div>
                  <span className="text-xl font-bold">{totalCount}</span>{" "}
                  <span className="text-orange-100">공개 활동</span>
                </div>
                {totalDistance > 0 && (
                  <div>
                    <span className="text-xl font-bold">{totalDistance.toLocaleString()}</span>{" "}
                    <span className="text-orange-100">km</span>
                  </div>
                )}
              </div>
            )}

            {/* CTA */}
            {!isLoggedIn && (
              <button
                onClick={signInWithGoogle}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white text-orange-600 rounded-lg text-sm font-semibold hover:bg-orange-50 transition-colors shadow-sm"
              >
                시작하기
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            )}
            {isLoggedIn && !stravaConnected && (
              <button
                onClick={() => navigate("/settings")}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/30 transition-colors backdrop-blur-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Strava 연동하기
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Activity Feed */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              {isLoggedIn ? "활동 피드" : "최근 공개 활동"}
              {totalCount > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">{totalCount}개</span>
              )}
            </h2>
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
                <p className="text-sm text-gray-400">아직 공개된 활동이 없습니다.</p>
              )}
            </div>
          ) : (
            <>
              {feed.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
              {hasMore && (
                <button
                  onClick={loadMore}
                  className="w-full py-3 text-sm font-medium text-orange-600 bg-white rounded-lg border border-gray-200 hover:bg-orange-50 transition-colors"
                >
                  더 보기 ({totalCount - feed.length}개 남음)
                </button>
              )}
            </>
          )}

          {/* Community links: mobile only (below feed) */}
          <div className="lg:hidden">
            <CommunityCard />
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="hidden lg:block w-80 flex-shrink-0 space-y-5">
          {isLoggedIn ? (
            <>
              {/* Profile summary */}
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <Link to={`/athlete/${user.uid}`} className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-lg font-bold text-orange-600">
                      {(profile?.nickname ?? user.displayName ?? "R").charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-sm">{profile?.nickname ?? user.displayName}</div>
                  </div>
                </Link>
                {profile?.stravaConnected && (
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
              {weeklyStats.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">주간 거리 (최근 12주)</h3>
                  <WeeklyChart data={weeklyStats} dataKey="distance" height={140} />
                </div>
              )}

              {/* Quick links */}
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

              {/* Community links: desktop sidebar */}
              <CommunityCard />
            </>
          ) : (
            /* Not logged in: login prompt + community */
            <>
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
                  🚴
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">O-Rider에 오신 것을 환영합니다</h3>
                <p className="text-sm text-gray-500 mb-4">
                  로그인하고 Strava를 연동하면 나의 라이딩 기록을 관리할 수 있습니다.
                </p>
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google로 로그인
                </button>
              </div>

              {/* Community links: desktop sidebar (not logged in) */}
              <CommunityCard />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
