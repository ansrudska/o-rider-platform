import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { ref, get } from "firebase/database";
import { firestore, database, functions } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useStrava } from "../hooks/useStrava";
import { useExport } from "../hooks/useExport";
import type { Visibility } from "@shared/types";

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { connectStrava, disconnectStrava, deleteUserData, loading, error } = useStrava();
  const { exportData, loading: exportLoading, error: exportError, progress: exportProgress } = useExport();
  const [deleteResult, setDeleteResult] = useState<{ deletedActivities: number; deletedStreams: number } | null>(null);
  const currentVisibility = profile?.defaultVisibility ?? "everyone";
  const [selectedVisibility, setSelectedVisibility] = useState<Visibility | null>(null);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityResult, setVisibilityResult] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [friendCode, setFriendCode] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    get(ref(database, `users/${user.uid}/friendCode`)).then((snap) => {
      if (snap.exists()) setFriendCode(snap.val());
    });
  }, [user]);

  if (!user) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        설정을 보려면 로그인이 필요합니다.
      </div>
    );
  }

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed || !user) return;
    setNicknameSaving(true);
    try {
      // Update profile
      await updateDoc(doc(firestore, "users", user.uid), { nickname: trimmed });
      // Update all activities with the new nickname
      const activitiesSnap = await getDocs(
        query(collection(firestore, "activities"), where("userId", "==", user.uid)),
      );
      if (!activitiesSnap.empty) {
        const batch = writeBatch(firestore);
        activitiesSnap.docs.forEach((d) => batch.update(d.ref, { nickname: trimmed }));
        await batch.commit();
      }
      showToast("닉네임이 변경되었습니다");
      setEditingNickname(false);
    } finally {
      setNicknameSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Strava 연동을 해제하시겠습니까?")) return;
    try {
      await disconnectStrava();
      showToast("Strava 연동이 해제되었습니다");
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
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
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
          <div className="flex-1">
            {editingNickname ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSaveNickname();
                    }
                    if (e.key === "Escape") setEditingNickname(false);
                  }}
                  maxLength={20}
                  autoFocus
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-orange-400 w-48 dark:bg-gray-900 dark:text-gray-50"
                />
                <button
                  onClick={handleSaveNickname}
                  disabled={nicknameSaving || !nicknameInput.trim()}
                  className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  {nicknameSaving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setEditingNickname(false)}
                  className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  취소
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-semibold">{profile?.nickname ?? user.displayName}</span>
                <button
                  onClick={() => {
                    setNicknameInput(profile?.nickname ?? user.displayName ?? "");
                    setEditingNickname(true);
                  }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-orange-500 transition-colors"
                >
                  수정
                </button>
              </div>
            )}
            {friendCode && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">친구 코드</span>
                <span className="font-mono font-semibold text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{friendCode}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(friendCode); showToast("복사되었습니다"); }}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-orange-500 transition-colors"
                  title="복사"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visibility section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">공개 범위</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
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
                    ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 text-orange-700 font-medium"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
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

      {/* Data export section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-2">데이터 내보내기</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          모든 라이딩 기록, 사진, 댓글, 소셜 데이터를 ZIP 파일로 내보냅니다.
        </p>

        <button
          onClick={exportData}
          disabled={exportLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exportLoading ? "내보내는 중..." : "ZIP으로 내보내기"}
        </button>

        {exportProgress && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                style={{
                  width: `${(() => {
                    const weights = { activities: 5, streams: 25, social: 15, photos: 45, zip: 10 };
                    const phases = ["activities", "streams", "social", "photos", "zip"] as const;
                    let pct = 0;
                    for (const p of phases) {
                      if (p === exportProgress.phase) {
                        pct += exportProgress.total > 0
                          ? weights[p] * (exportProgress.current / exportProgress.total)
                          : 0;
                        break;
                      }
                      pct += weights[p];
                    }
                    return Math.min(100, Math.round(pct));
                  })()}%`,
                }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5">{exportProgress.label}</p>
          </div>
        )}

        {exportError && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
            {exportError}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          포함 항목: GPX 트랙, 요약 CSV, 댓글, 좋아요, 사진, 세그먼트 PR, 팔로잉/팔로워
        </div>
      </div>

      {/* Strava section */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
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
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Strava 계정: <strong>{profile.stravaNickname}</strong>
              <span className="text-gray-400 dark:text-gray-500 ml-2">
                (ID: {profile.stravaAthleteId})
              </span>
            </div>

            <div className="space-y-3">
              <Link
                to="/migrate"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                {profile?.migration?.status === "DONE" ? "복사 결과 보기" : "스트라바 복사하기"}
              </Link>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={async () => {
                    if (!window.confirm("GPS/사진 캐시를 초기화합니다. 활동 상세 조회 시 Strava에서 다시 가져옵니다.")) return;
                    try {
                      setDeleteResult(null);
                      const result = await deleteUserData(true);
                      setDeleteResult({ deletedActivities: 0, deletedStreams: result.deletedStreams });
                    } catch { /* error in hook */ }
                  }}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 transition-colors"
                >
                  {loading ? "처리 중..." : "스트림 캐시 초기화"}
                </button>
                <button
                  onClick={handleDeleteData}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  {loading ? "삭제 중..." : "Strava 데이터 삭제"}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  Strava 연동 해제
                </button>
              </div>
              {deleteResult && (
                <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded">
                  삭제 완료: 활동 {deleteResult.deletedActivities}개, 스트림 {deleteResult.deletedStreams}개
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
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
          <div className="mt-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
            {error}
          </div>
        )}
      </div>

    </div>
  );
}
