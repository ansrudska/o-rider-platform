import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { connectStrava, disconnectStrava, importActivities, loading, error } = useStrava();
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null);
  const [importPage, setImportPage] = useState(1);

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">
        설정을 보려면 로그인이 필요합니다.
      </div>
    );
  }

  const handleImport = async () => {
    try {
      const result = await importActivities(importPage, 30);
      setImportResult(result);
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
              <label className="text-sm text-gray-600">페이지:</label>
              <input
                type="number"
                min={1}
                value={importPage}
                onChange={(e) => setImportPage(Number(e.target.value))}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "가져오는 중..." : "활동 가져오기"}
              </button>
            </div>

            {importResult && (
              <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
                {importResult.imported}개 새 활동 가져옴 (전체 {importResult.total}개 Ride 중)
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
