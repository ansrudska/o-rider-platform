import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import type { MigrationScope, MigrationPeriod } from "@shared/types";

type Step = "landing" | "scope" | "progress" | "report";

export default function MigrationPage() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signInWithGoogle } = useAuth();
  const { connectStrava, startMigration, importMigrationActivities, loading, error, rateLimitCountdown } = useStrava();

  const [step, setStep] = useState<Step | null>(null);
  const [period, setPeriod] = useState<MigrationPeriod>("recent_90");
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeSegments, setIncludeSegments] = useState(true);
  const migrationStarted = useRef(false);

  // Determine initial step based on migration status
  useEffect(() => {
    if (authLoading) return;
    // Not logged in — show landing immediately
    if (!user) {
      setStep("landing");
      return;
    }
    // Logged in but profile not yet loaded from Firestore — keep spinner
    if (!profile) return;

    const status = profile.migration?.status;
    if (status === "RUNNING" || status === "PARTIAL_DONE") {
      setStep("progress");
    } else if (status === "DONE" && profile.migration?.report) {
      setStep("report");
    } else {
      setStep("landing");
    }
  }, [authLoading, user, profile]);

  // Auto-start import loop when entering progress step and migration is RUNNING
  useEffect(() => {
    if (step !== "progress" || migrationStarted.current) return;
    if (!profile?.migration?.scope) return;

    migrationStarted.current = true;

    const scope = profile.migration.scope;
    importMigrationActivities(scope).catch(() => {
      // Error is set in hook
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, profile?.migration?.scope]);

  const handleStartMigration = async () => {
    const scope: MigrationScope = { period, includePhotos, includeSegments };
    try {
      await startMigration(scope);
      migrationStarted.current = false; // Reset so the effect picks it up
      setStep("progress");
    } catch {
      // error is set in hook
    }
  };

  const migration = profile?.migration;
  const progress = migration?.progress;
  const report = migration?.report;

  // Calculate progress percentage (activities phase: 0-49%, streams phase: 50-100%)
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
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              스트라바 기록을 안전하게 보관하세요
            </h1>
            <p className="text-gray-500">
              소중한 라이딩 기록을 O-Rider에 복사합니다.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: "M5 13l4 4L19 7", text: "스트라바 기록을 O-Rider에 그대로 복사" },
              { icon: "M5 13l4 4L19 7", text: "스트라바 계정은 계속 사용 가능" },
              { icon: "M5 13l4 4L19 7", text: "언제든 GPX로 다시 내보낼 수 있습니다" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3 text-sm text-gray-700">
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
            <p className="text-xs text-center text-gray-400">
              Strava 계정: {profile.stravaNickname}
            </p>
          )}
        </div>
      )}

      {/* Step 1: Scope */}
      {step === "scope" && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">복사 범위 선택</h1>
            <p className="text-sm text-gray-500 mt-1">어느 기간의 기록을 가져올지 선택하세요.</p>
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
                    : "border-gray-200 hover:border-gray-300"
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
                  <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                  {opt.desc && (
                    <span className="ml-2 text-xs text-gray-400">{opt.desc}</span>
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
              <span className="text-sm text-gray-700">사진 포함</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSegments}
                onChange={(e) => setIncludeSegments(e.target.checked)}
                className="accent-orange-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700">세그먼트/PR 포함</span>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("landing")}
              className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
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
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto">
              <div className="w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              {phase === "streams" ? "상세 데이터 가져오는 중..." : "활동 목록 가져오는 중..."}
            </h1>
          </div>

          {/* Stats cards */}
          {phase === "streams" ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.fetchedStreams ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">스트림 완료</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.totalStreams ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">전체 활동</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.failedStreams ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">실패</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {progress ? progress.importedActivities + progress.skippedActivities : 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">활동</div>
                {progress && progress.skippedActivities > 0 && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    ({progress.skippedActivities}개 스킵)
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.currentPage ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">페이지</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.importedActivities ?? 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">새로 가져옴</div>
              </div>
            </div>
          )}

          {/* Rate limit countdown banner */}
          {rateLimitCountdown > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
              <p className="text-sm text-amber-700 font-medium">
                API 제한에 도달했습니다. {rateLimitCountdown}초 후 자동으로 재시도합니다.
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-700"
                style={{ width: `${migration?.status === "DONE" ? 100 : Math.max(5, progressPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>
                {phase === "streams"
                  ? `GPS/사진/세그먼트 ${progress?.fetchedStreams ?? 0} / ${progress?.totalStreams ?? 0}`
                  : `페이지 ${progress?.currentPage ?? 0} 처리 중`}
              </span>
              <span>{migration?.status === "DONE" ? "100" : progressPercent}%</span>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-xs text-gray-400">
              앱을 닫아도 진행 상태는 유지됩니다.
            </p>
            <p className="text-xs text-gray-400">
              이미 가져온 활동은 자동으로 건너뜁니다.
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded text-center">
              {error}
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
        <div className="bg-white rounded-lg border border-gray-200 p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">복사 완료!</h1>
            <p className="text-sm text-gray-500">모든 기록이 안전하게 보관되었습니다.</p>
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
            <div className="text-center text-sm text-gray-500">
              {formatDate(report.earliestActivity)} ~ {formatDate(report.latestActivity)}
            </div>
          )}

          {/* Top routes */}
          {report.topRoutes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">대표 코스 TOP {report.topRoutes.length}</h3>
              {report.topRoutes.map((route, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <span className="text-lg font-bold text-orange-500 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{route.name}</div>
                    <div className="text-xs text-gray-400">
                      {(route.distance / 1000).toFixed(1)}km · {route.count}회
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
            >
              내 기록 보기
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="w-full px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              스트라바와 계속 병행 사용하기
            </button>
          </div>
        </div>
      )}

      {/* Report step but no report data yet */}
      {step === "report" && !report && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center space-y-4">
          <div className="w-8 h-8 mx-auto border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">리포트를 생성하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900 mt-0.5">{value}</div>
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
