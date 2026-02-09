import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useStrava, type ImportProgress } from "../hooks/useStrava";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { connectStrava, disconnectStrava, importAllActivities, loading, error } = useStrava();
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">
        설정을 보려면 로그인이 필요합니다.
      </div>
    );
  }

  const handleImportAll = async () => {
    setProgress(null);
    try {
      await importAllActivities((p) => setProgress({ ...p }));
    } catch {
      // error is set in hook
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Strava 연동을 해제하시겠습니까?")) return;
    try {
      await disconnectStrava();
    } catch {
      // error is set in hook
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* Profile section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">프로필</h2>
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-16 h-16 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-2xl font-bold text-orange-600">
              {(profile?.nickname ?? "U").charAt(0)}
            </div>
          )}
          <div>
            <div className="font-semibold">{profile?.nickname ?? user.displayName}</div>
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>
      </div>

      {/* Strava section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Strava 연동</h2>
          {profile?.stravaConnected && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              연결됨
            </span>
          )}
        </div>

        {profile?.stravaConnected ? (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Strava 계정: <strong>{profile.stravaNickname}</strong>
              <span className="text-gray-400 ml-2">
                (ID: {profile.stravaAthleteId})
              </span>
            </div>

            {/* Import controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleImportAll}
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "가져오는 중..." : "전체 활동 가져오기"}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Strava의 모든 라이딩 기록을 가져옵니다. 이미 가져온 활동은 건너뜁니다.
            </p>

            {/* Progress display */}
            {progress && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                {progress.done ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      가져오기 완료
                    </div>
                    <div className="text-sm text-gray-600">
                      {progress.totalImported > 0 ? (
                        <>{progress.totalImported}개 새 활동 가져옴</>
                      ) : (
                        <>새로 가져올 활동이 없습니다</>
                      )}
                      <span className="text-gray-400 ml-1">
                        ({progress.totalRides}개 Ride 검색, {progress.page}페이지)
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
                      <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      페이지 {progress.page} 처리 중...
                    </div>
                    <div className="text-sm text-gray-600">
                      {progress.totalImported}개 가져옴 · {progress.totalRides}개 Ride 검색됨
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-orange-500 h-1.5 rounded-full transition-all duration-300 animate-pulse" style={{ width: "60%" }} />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Strava 연동 해제
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Strava 계정을 연동하면 라이딩 활동을 자동으로 가져올 수 있습니다.
            </p>
            <button
              onClick={connectStrava}
              className="flex items-center gap-2 px-4 py-2 bg-[#FC4C02] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Strava 연동하기
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
