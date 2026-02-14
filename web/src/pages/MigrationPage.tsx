import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import type { MigrationScope, MigrationPeriod } from "@shared/types";

type Step = "landing" | "scope" | "progress" | "report";

export default function MigrationPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signInWithGoogle } = useAuth();
  const { connectStrava, startMigration, cancelMigration, verifyMigration, fixMigration, loading, error } = useStrava();

  const [step, setStep] = useState<Step | null>(null);
  const [period, setPeriod] = useState<MigrationPeriod>("recent_90");
  const [verifyResult, setVerifyResult] = useState<{
    totalStrava: number;
    totalImported: number;
    missingActivityCount: number;
    missingStreamCount: number;
  } | null>(null);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [includeSegments, setIncludeSegments] = useState(false);
  const [fixIncludePhotos, setFixIncludePhotos] = useState(false);
  const [fixIncludeSegments, setFixIncludeSegments] = useState(false);

  // Determine initial step based on migration status
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStep("landing");
      return;
    }
    if (!profile) return;

    const status = profile.migration?.status;
    if (status === "QUEUED" || status === "RUNNING" || status === "WAITING" || status === "PARTIAL_DONE") {
      setStep("progress");
    } else if (status === "DONE" && profile.migration?.report) {
      setStep("report");
    } else {
      setStep("landing");
    }
  }, [authLoading, user, profile]);

  const handleStartMigration = async () => {
    const scope: MigrationScope = { period, includePhotos, includeSegments };
    try {
      await startMigration(scope);
      setStep("progress");
    } catch {
      // error is set in hook
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMigration();
      setStep("landing");
    } catch {
      // error is set in hook
    }
  };

  const handleRetry = async () => {
    const scope = migration?.scope;
    if (!scope) return;
    try {
      await startMigration(scope);
      setStep("progress");
    } catch {
      // error is set in hook
    }
  };

  const handleVerify = async () => {
    setVerifyResult(null);
    try {
      const result = await verifyMigration();
      setVerifyResult(result);
    } catch {
      // error is set in hook
    }
  };

  const handleFix = async () => {
    try {
      const result = await fixMigration({ includePhotos: fixIncludePhotos, includeSegments: fixIncludeSegments });
      setVerifyResult(null);
      if (result.streamsQueued > 0) {
        setStep("progress");
      } else {
        // Activities imported, no streams needed — report will update via Firestore
      }
    } catch {
      // error is set in hook
    }
  };

  /* MOCK LOGIC REMOVED */
  const migration = profile?.migration;
  const progress = migration?.progress;
  const report = migration?.report;

  // Calculate progress percentage
  const phase = progress?.phase ?? "activities";
  const progressPercent = (() => {
    if (!progress) return 0;
    if (phase === "activities") {
      if (progress.totalActivities > 0) {
        return Math.min(49, Math.round(((progress.importedActivities + progress.skippedActivities) / progress.totalActivities) * 49));
      }
      return progress.currentPage ? Math.min(45, progress.currentPage * 10) : 0;
    }
    if (phase === "streams") {
      if (progress.totalStreams > 0) {
        return 50 + Math.min(49, Math.round((progress.fetchedStreams / progress.totalStreams) * 49));
      }
      return 50;
    }
    return 99;
  })();

  // Queue position and wait info
  const queuePosition = progress?.queuePosition;
  const waitUntil = progress?.waitUntil;
  const estimatedMinutes = progress?.estimatedMinutes;
  const migrationStatus = migration?.status;

  if (authLoading || step === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step 0: Landing */}
      {step === "landing" && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              스트라바 기록을 안전하게 보관하세요
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              소중한 라이딩 기록을 O-Rider에 복사합니다.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: "M5 13l4 4L19 7", text: "스트라바 기록을 O-Rider에 그대로 복사" },
              { icon: "M5 13l4 4L19 7", text: "스트라바 계정은 계속 사용 가능" },
              { icon: "M5 13l4 4L19 7", text: "언제든 GPX로 다시 내보낼 수 있습니다" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-200">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                {item.text}
              </div>
            ))}
          </div>

          <div className="pt-2 space-y-3">
            {!user ? (
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google로 로그인
              </button>
            ) : !profile?.stravaConnected ? (
              <button
                onClick={() => connectStrava("/migrate")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FC4C02] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                스트라바 연결하기
              </button>
            ) : (
              <button
                onClick={() => setStep("scope")}
                className="w-full px-4 py-3 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                복사 시작하기
              </button>
            )}
          </div>

          {profile?.stravaConnected && (
            <p className="text-xs text-center text-gray-400 dark:text-gray-500">
              Strava 계정: {profile.stravaNickname}
            </p>
          )}

          {/* Show error for FAILED status */}
          {migrationStatus === "FAILED" && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 space-y-2">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">이전 가져오기가 중단되었어요.</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">이미 가져온 데이터는 안전하게 보관되어 있어요.</p>
              <button
                onClick={handleRetry}
                disabled={loading}
                className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "준비 중..." : "이어서 가져오기"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Scope */}
      {step === "scope" && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">복사 범위 선택</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">어느 기간의 기록을 가져올지 선택하세요.</p>
          </div>

          <div className="space-y-2">
            {([
              { value: "recent_90" as const, label: "최근 90일", desc: "권장" },
              { value: "recent_180" as const, label: "최근 180일", desc: "" },
              { value: "all" as const, label: "전체 기간", desc: "시간이 오래 걸릴 수 있습니다" },
            ] as const).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  period === opt.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="period"
                  value={opt.value}
                  checked={period === opt.value}
                  onChange={() => setPeriod(opt.value)}
                  className="accent-orange-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{opt.label}</span>
                  {opt.desc && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{opt.desc}</span>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePhotos}
                onChange={(e) => setIncludePhotos(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">사진 포함</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSegments}
                onChange={(e) => setIncludeSegments(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">세그먼트/PR 포함</span>
            </label>
            {(includePhotos || includeSegments) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 ml-7">
                활동당 추가 API 호출이 필요해 복사 시간이 크게 늘어납니다
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("landing")}
              className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              뒤로
            </button>
            <button
              onClick={handleStartMigration}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "준비 중..." : "복사 시작"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Progress */}
      {step === "progress" && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6">
          <div className="text-center space-y-2">
            {migrationStatus === "FAILED" ? (
              <>
                <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">잠시 문제가 발생했어요</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  걱정하지 마세요. 이미 가져온 데이터는 안전하게 보관되어 있습니다.
                </p>
              </>
            ) : migrationStatus === "QUEUED" && queuePosition != null && queuePosition > 0 ? (
              <>
                <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">#{queuePosition}</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">순서를 기다리고 있어요</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  앞에 {queuePosition}명이 사용 중이에요.
                  {estimatedMinutes != null && <> 약 <strong>{formatEstimate(estimatedMinutes)}</strong> 후 시작됩니다.</>}
                </p>
              </>
            ) : migrationStatus === "WAITING" ? (
              <>
                <div className="w-12 h-12 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">잠시 쉬어가는 중이에요</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  스트라바 서버 보호를 위해 잠시 대기 중입니다.
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 mx-auto">
                  <div className="w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">
                  {phase === "streams" ? "GPS와 상세 데이터를 가져오고 있어요" : "라이딩 기록을 찾고 있어요"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {phase === "streams"
                    ? "각 라이딩의 경로, 심박수, 파워 등을 하나씩 가져오고 있어요."
                    : "스트라바에서 라이딩 목록을 확인하고 있어요."}
                  {estimatedMinutes != null && estimatedMinutes > 0 && (
                    <> 약 <strong>{formatEstimate(estimatedMinutes)}</strong> 정도 걸릴 것 같아요.</>
                  )}
                </p>
              </>
            )}
          </div>

          {/* WAITING banner */}
          {migrationStatus === "WAITING" && waitUntil && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-center space-y-1">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                {formatTime(waitUntil)}에 자동으로 다시 시작해요.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                별도 조작 없이 자동 재개되니 편하게 기다려 주세요.
              </p>
            </div>
          )}

          {/* FAILED banner */}
          {migrationStatus === "FAILED" && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-center space-y-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                일시적인 네트워크 문제이거나 스트라바 서버 응답이 늦어지고 있어요.
                <br />지금까지 가져온 기록은 안전합니다. <strong>이어서 가져오기</strong>를 누르면 중단된 곳부터 다시 시작해요.
              </p>
              <button
                onClick={handleRetry}
                disabled={loading}
                className="px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {loading ? "준비 중..." : "이어서 가져오기"}
              </button>
            </div>
          )}

          {/* Stats cards */}
          {migrationStatus !== "FAILED" && (
            phase === "streams" ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {progress?.fetchedStreams ?? 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">완료</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {progress?.totalStreams ?? 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">전체</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {(progress?.totalStreams ?? 0) - (progress?.fetchedStreams ?? 0) - (progress?.failedStreams ?? 0)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">남은 활동</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {progress?.importedActivities ?? 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">새로 가져옴</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                    {progress ? progress.importedActivities + progress.skippedActivities : 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">확인한 활동</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                    {progress?.skippedActivities ?? 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">이미 있음</div>
                </div>
              </div>
            )
          )}

          {/* Progress bar */}
          {migrationStatus !== "FAILED" && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${migrationStatus === "WAITING" ? "bg-amber-500" : "bg-orange-500"}`}
                  style={{ width: `${migration?.status === "DONE" ? 100 : Math.max(5, progressPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>
                  {phase === "streams"
                    ? `GPS 데이터 ${progress?.fetchedStreams ?? 0} / ${progress?.totalStreams ?? 0}`
                    : `${progress?.currentPage ?? 0}페이지 확인 완료`}
                </span>
                <span>{migration?.status === "DONE" ? "100" : progressPercent}%</span>
              </div>
            </div>
          )}

          {/* Helpful info box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-3 space-y-1">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
              이 페이지를 닫아도 괜찮아요
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              서버에서 자동으로 진행되며, 나중에 다시 방문하면 진행 상태를 확인할 수 있어요.
              이미 가져온 활동은 다시 가져오지 않아요.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded text-center">
              {error}
            </div>
          )}

          {/* Cancel button */}
          {migrationStatus !== "DONE" && migrationStatus !== "FAILED" && (
            <div className="text-center">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {loading ? "취소 중..." : "가져오기 취소"}
              </button>
            </div>
          )}

          {/* Auto-transition to report when done */}
          {migration?.status === "DONE" && report && (
            <div className="text-center">
              <button
                onClick={() => setStep("report")}
                className="px-6 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                결과 보기
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Report */}
      {step === "report" && report && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">모든 기록을 가져왔어요!</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              소중한 라이딩 기록이 O-Rider에 안전하게 보관되었습니다.
            </p>
          </div>

          {/* Auto-sync info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">자동 동기화가 켜져 있어요</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              앞으로 스트라바에 새로운 라이딩을 기록하면 O-Rider에도 자동으로 추가돼요.
            </p>
            {report.latestActivity > 0 && (
              <p className="text-xs text-blue-500 dark:text-blue-400">
                마지막으로 가져온 라이딩: {formatDateTime(report.latestActivity)}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatItem label="가져온 활동" value={`${report.totalActivities.toLocaleString()}개`} />
            <StatItem label="총 거리" value={`${Math.round(report.totalDistance / 1000).toLocaleString()} km`} />
            <StatItem label="총 라이딩 시간" value={formatDuration(report.totalTime)} />
            <StatItem label="총 획득고도" value={`${Math.round(report.totalElevation).toLocaleString()} m`} />
            <StatItem label="GPS 데이터" value={`${(report.totalStreams ?? 0).toLocaleString()}개`} />
            <StatItem label="사진" value={`${report.totalPhotos.toLocaleString()}장`} />
            <StatItem label="세그먼트 기록" value={`${(report.totalSegmentEfforts ?? report.totalSegmentPRs ?? 0).toLocaleString()}개`} />
            <StatItem label="칼로리" value={report.totalCalories ? `${report.totalCalories.toLocaleString()} kcal` : "-"} />
          </div>

          {/* Date range */}
          {report.earliestActivity > 0 && report.latestActivity > 0 && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              {formatDate(report.earliestActivity)} ~ {formatDate(report.latestActivity)}
            </div>
          )}

          {/* Top routes */}
          {report.topRoutes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">대표 코스 TOP {report.topRoutes.length}</h3>
              {report.topRoutes.map((route, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  <span className="text-lg font-bold text-orange-500 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{route.name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      {(route.distance / 1000).toFixed(1)}km · {route.count}회
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate("/")}
            className="w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            내 기록 보기
          </button>

          {/* Verify & Fix */}
          {!verifyResult && (
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "스트라바와 대조 중..." : "혹시 빠진 기록이 있나요?"}
            </button>
          )}

          {verifyResult && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">검증 결과</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-500 dark:text-gray-400">스트라바 라이딩</div>
                <div className="text-gray-900 dark:text-gray-50 font-medium">{verifyResult.totalStrava}개</div>
                <div className="text-gray-500 dark:text-gray-400">가져온 라이딩</div>
                <div className="text-gray-900 dark:text-gray-50 font-medium">{verifyResult.totalImported}개</div>
                {verifyResult.missingActivityCount > 0 && (
                  <>
                    <div className="text-gray-500 dark:text-gray-400">빠진 라이딩</div>
                    <div className="font-medium text-amber-600 dark:text-amber-400">{verifyResult.missingActivityCount}개</div>
                  </>
                )}
                {verifyResult.missingStreamCount > 0 && (
                  <>
                    <div className="text-gray-500 dark:text-gray-400">빠진 GPS 데이터</div>
                    <div className="font-medium text-amber-600 dark:text-amber-400">{verifyResult.missingStreamCount}개</div>
                  </>
                )}
              </div>

              {verifyResult.missingActivityCount === 0 && verifyResult.missingStreamCount === 0 ? (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2 text-center">
                  <p className="text-sm text-green-700 font-medium">
                    모든 기록이 빠짐없이 가져와졌어요!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    빠진 데이터만 추가로 가져올 수 있어요. 기존 데이터는 영향받지 않아요.
                  </p>
                  <div className="space-y-1 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fixIncludePhotos}
                        onChange={(e) => setFixIncludePhotos(e.target.checked)}
                        className="accent-orange-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-300">사진 포함</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fixIncludeSegments}
                        onChange={(e) => setFixIncludeSegments(e.target.checked)}
                        className="accent-orange-500 w-3.5 h-3.5"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-300">세그먼트/PR 포함</span>
                    </label>
                    {(fixIncludePhotos || fixIncludeSegments) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 ml-5.5">
                        활동당 추가 API 호출이 필요해 복사 시간이 크게 늘어납니다
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleFix}
                    disabled={loading}
                    className="w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "가져오는 중..." : `빠진 기록 ${verifyResult.missingActivityCount + verifyResult.missingStreamCount}개 가져오기`}
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded text-center">
              {error}
            </div>
          )}

          <button
            onClick={() => setStep("scope")}
            className="w-full px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            처음부터 다시 가져오기
          </button>
        </div>
      )}

      {/* Report step but no report data yet */}
      {step === "report" && !report && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center space-y-4">
          <div className="w-8 h-8 mx-auto border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">리포트를 생성하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-50 mt-0.5">{value}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainHours = hours % 24;
    return `${days}일 ${remainHours}시간`;
  }
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}시간 ${minutes}분`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatEstimate(minutes: number): string {
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${Math.round(minutes)}분`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}
