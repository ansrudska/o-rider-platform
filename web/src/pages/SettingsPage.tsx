import { useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import type { Visibility } from "@shared/types";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { connectStrava, disconnectStrava, deleteUserData, loading, error } = useStrava();
  const [deleteResult, setDeleteResult] = useState<{ deletedActivities: number; deletedStreams: number } | null>(null);
  const currentVisibility = profile?.defaultVisibility ?? "everyone";
  const [selectedVisibility, setSelectedVisibility] = useState<Visibility | null>(null);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityResult, setVisibilityResult] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500">
        설정을 보려면 로그인이 필요합니다.
      </div>
    );
  }

  const handleDisconnect = async () => {
    if (!window.confirm("Strava 연동을 해제하시겠습니까?")) return;
    try {
      await disconnectStrava();
    } catch {
      // error is set in hook
    }
  };

  const handleDeleteData = async () => {
    if (!window.confirm("Strava에서 가져온 모든 활동과 GPS 데이터를 삭제합니다. 계속하시겠습니까?")) return;
    try {
      setDeleteResult(null);
      const result = await deleteUserData();
      setDeleteResult(result);
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

      {/* Visibility section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">공개 범위</h2>
        <p className="text-sm text-gray-500 mb-3">
          새로 가져오는 활동의 기본 공개 범위를 설정합니다.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            {([
              { value: "everyone", label: "전체 공개" },
              { value: "friends", label: "팔로워만" },
              { value: "private", label: "비공개" },
            ] as { value: Visibility; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setSelectedVisibility(opt.value);
                  setVisibilityResult(null);
                }}
                className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                  (selectedVisibility ?? currentVisibility) === opt.value
                    ? "bg-orange-50 border-orange-300 text-orange-700 font-medium"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {selectedVisibility && selectedVisibility !== currentVisibility && (
            <button
              onClick={async () => {
                setVisibilitySaving(true);
                setVisibilityResult(null);
                try {
                  const fn = httpsCallable<{ visibility: string }, { updated: number }>(functions, "updateDefaultVisibility");
                  const result = await fn({ visibility: selectedVisibility });
                  setVisibilityResult(`저장 완료 (활동 ${result.data.updated}개 업데이트)`);
                  setSelectedVisibility(null);
                } catch {
                  setVisibilityResult("저장 실패");
                } finally {
                  setVisibilitySaving(false);
                }
              }}
              disabled={visibilitySaving}
              className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
            >
              {visibilitySaving ? "적용 중..." : "적용"}
            </button>
          )}
          {visibilityResult && (
            <span className={`text-sm ${visibilityResult.includes("실패") ? "text-red-600" : "text-green-600"}`}>
              {visibilityResult}
            </span>
          )}
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

            <div className="space-y-3">
              <Link
                to="/migrate"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {profile?.migration?.status === "DONE" ? "복사 결과 보기" : "스트라바 복사하기"}
              </Link>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteData}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {loading ? "삭제 중..." : "Strava 데이터 삭제"}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  Strava 연동 해제
                </button>
              </div>
              {deleteResult && (
                <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
                  삭제 완료: 활동 {deleteResult.deletedActivities}개, 스트림 {deleteResult.deletedStreams}개
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Strava 계정을 연동하면 라이딩 활동을 자동으로 가져올 수 있습니다.
            </p>
            <button
              onClick={() => connectStrava()}
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
