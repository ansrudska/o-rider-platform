import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import type { MigrationScope, MigrationPeriod } from "@shared/types";

type Step = "landing" | "scope" | "progress" | "report";

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export default function MigrationPage() {
  const navigate = useNavigate();
  const { user, profile,loading: authLoading, signInWithGoogle } = useAuth();
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
    } else if (status === "DONE") {
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
      }
    } catch {
      // error is set in hook
    }
  };

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
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {step === "report" ? "데이터 가져오기 완료" : "Strava 데이터 가져오기"}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          O-Rider로 소중한 라이딩 기록을 안전하게 옮겨오세요.
        </p>
      </div>

      {step === "landing" && (
        <Section className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              {profile?.stravaConnected && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-100 border-2 border-white dark:border-gray-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {profile?.stravaConnected ? "데이터를 가져올 준비가 되었어요" : "Strava 계정을 연결해주세요"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                Strava의 모든 라이딩 기록과 상세 데이터를 O-Rider로 복사합니다. 기존 기록은 그대로 유지됩니다.
              </p>
            </div>

            <div className="w-full max-w-sm space-y-3">
              {!user ? (
                <button
                  onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-gray-900 dark:text-white shadow-sm"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  Google로 로그인
                </button>
              ) : !profile?.stravaConnected ? (
                <button
                  onClick={() => connectStrava("/migrate")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#FC4C02] text-white rounded-xl hover:bg-[#E34402] transition-colors font-bold shadow-sm"
                >
                  Strava 연결하기
                </button>
              ) : (
                <button
                  onClick={() => setStep("scope")}
                  className="w-full px-4 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors font-bold shadow-sm"
                >
                  시작하기
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-6 border-t border-gray-100 dark:border-gray-800">
               {[
                 { label: "안전한 보관", desc: "데이터는 암호화 및 2중화 백업으로 안전하게 보관됩니다" },
                 { label: "실시간 동기화", desc: "새로운 라이딩 기록도 자동으로 추가됩니다" },
                 { label: "데이터 전체 내보내기", desc: "모든 라이딩 기록, 사진, 댓글, 소셜 데이터를 ZIP 파일로 받으세요" }
               ].map((item) => (
                 <div key={item.label} className="text-center">
                   <div className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</div>
                   <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.desc}</div>
                 </div>
               ))}
            </div>
          </div>
        </Section>
      )}

      {step === "scope" && (
        <Section className="p-6 sm:p-8">
           <div className="space-y-6">
             <div>
               <h2 className="text-lg font-bold text-gray-900 dark:text-white">기간 선택</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">가져올 라이딩 기록의 기간을 선택해주세요.</p>
             </div>

             <div className="grid gap-3">
              {([
                { value: "recent_90" as const, label: "최근 3개월 (권장)", desc: "가장 최근의 라이딩만 빠르게 가져옵니다." },
                { value: "recent_180" as const, label: "최근 6개월", desc: "반년 간의 시즌 기록을 모두 가져옵니다." },
                { value: "all" as const, label: "전체 기간", desc: "시간이 오래 걸릴 수 있지만 모든 기록을 백업합니다." },
              ] as const).map((opt) => (
                <label
                  key={opt.value}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    period === opt.value
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/10"
                      : "border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-900/30"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    period === opt.value ? "border-orange-500" : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {period === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                  </div>
                  <input
                    type="radio"
                    name="period"
                    value={opt.value}
                    checked={period === opt.value}
                    onChange={() => setPeriod(opt.value)}
                    className="sr-only"
                  />
                  <div>
                    <div className={`font-bold text-sm ${period === opt.value ? "text-orange-900 dark:text-orange-100" : "text-gray-900 dark:text-gray-100"}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="space-y-3 pt-2">
               <h3 className="text-sm font-bold text-gray-900 dark:text-white">추가 옵션</h3>
               <div className="space-y-2">
                 {[
                   { checked: includePhotos, set: setIncludePhotos, label: "사진 포함", desc: "라이딩에 첨부된 사진을 함께 가져옵니다." },
                   { checked: includeSegments, set: setIncludeSegments, label: "세그먼트/PR 포함", desc: "구간 기록과 PR 달성 내역을 분석합니다." }
                 ].map((opt) => (
                   <label key={opt.label} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        opt.checked ? "bg-orange-500 border-orange-500" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                      }`}>
                         {opt.checked && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="sr-only" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
                      </div>
                   </label>
                 ))}
               </div>
               {(includePhotos || includeSegments) && (
                 <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 rounded-lg">
                   ⚠️ 추가 옵션 선택 시 API 호출량이 많아져 시간이 더 소요될 수 있습니다.
                 </div>
               )}
            </div>

            <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
               <button
                 onClick={() => setStep("landing")}
                 className="px-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
               >
                 취소
               </button>
               <button
                 onClick={handleStartMigration}
                 disabled={loading}
                 className="flex-1 px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 transition-colors"
               >
                 {loading ? "시작하는 중..." : "가져오기 시작"}
               </button>
            </div>
           </div>
        </Section>
      )}

      {step === "progress" && (
        <Section className="p-8">
           <div className="text-center space-y-6">
              {/* Status Icon */}
              <div className="relative inline-block">
                 {migrationStatus === "FAILED" ? (
                   <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center animate-pulse">
                     <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                     </svg>
                   </div>
                 ) : migrationStatus === "WAITING" ? (
                   <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                     <svg className="w-10 h-10 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                   </div>
                 ) : (
                   <div className="w-20 h-20 relative">
                     <div className="absolute inset-0 border-4 border-gray-100 dark:border-gray-800 rounded-full" />
                     <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                     <div className="absolute inset-0 flex items-center justify-center font-bold text-orange-600 text-lg">
                       {Math.round(progressPercent)}%
                     </div>
                   </div>
                 )}
              </div>

              {/* Status Text */}
              <div className="space-y-2">
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                   {migrationStatus === "FAILED" ? "잠시 문제가 발생했어요" :
                    migrationStatus === "WAITING" ? "잠시 대기 중이에요" :
                    phase === "streams" ? "상세 데이터를 가져오는 중..." : "활동 목록을 확인하는 중..."}
                 </h2>
                 <p className="text-gray-500 dark:text-gray-400">
                   {migrationStatus === "FAILED" ? "네트워크 문제일 수 있습니다. 잠시 후 다시 시도해주세요." :
                    migrationStatus === "WAITING" ? `Strava API 제한으로 인해 ${formatTime(waitUntil ?? Date.now())}에 재개됩니다.` :
                    phase === "streams" ? "GPS 트랙, 심박수, 파워 등 상세 정보를 저장하고 있습니다." :
                    `총 ${progress?.totalActivities ?? 0}개의 활동 중 ${progress?.importedActivities ?? 0}개를 처리했습니다.`}
                 </p>
                 {estimatedMinutes != null && estimatedMinutes > 0 && migrationStatus !== "FAILED" && migrationStatus !== "WAITING" && (
                   <div className="inline-block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300">
                     약 {formatEstimate(estimatedMinutes)} 남음
                   </div>
                 )}
              </div>

              {/* Progress Bar */}
              {migrationStatus !== "FAILED" && (
                <div className="max-w-md mx-auto space-y-2">
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${migrationStatus === "WAITING" ? "bg-amber-500" : "bg-orange-500"}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                     <span>{phase === "activities" ? "목록 스캔" : "상세 데이터"}</span>
                     <span>{progress?.fetchedStreams ?? 0}/{progress?.totalStreams ?? 0}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-6">
                 {migrationStatus === "FAILED" ? (
                   <button
                     onClick={handleRetry}
                     disabled={loading}
                     className="px-6 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors"
                   >
                     다시 시도
                   </button>
                 ) : (
                   <button
                     onClick={handleCancel}
                     className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                   >
                     취소하기
                   </button>
                 )}
              </div>
           </div>
        </Section>
      )}

      {step === "report" && report && (
        <div className="space-y-6">
           <Section className="p-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                 <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                 </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">모두 가져왔습니다!</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  총 {report.totalActivities.toLocaleString()}개의 활동이 안전하게 저장되었습니다.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100 dark:border-gray-800">
                 <StatBox label="총 거리" value={`${Math.round(report.totalDistance / 1000).toLocaleString()}`} unit="km" />
                 <StatBox label="총 시간" value={formatDurationSimple(report.totalTime)} />
                 <StatBox label="획득고도" value={`${Math.round(report.totalElevation).toLocaleString()}`} unit="m" />
                 <StatBox label="사진" value={`${report.totalPhotos.toLocaleString()}`} unit="장" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                 <button
                   onClick={() => navigate("/")}
                   className="px-6 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors"
                 >
                   내 피드 보러가기
                 </button>
                 {!verifyResult && (
                   <button
                     onClick={handleVerify}
                     className="px-6 py-3 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors"
                   >
                     혹시 빠진게 있나요?
                   </button>
                 )}
              </div>
           </Section>

           {verifyResult && (
             <Section className="p-6">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">누락 데이터 확인</h3>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                     <span className="text-gray-500">Strava 활동</span>
                     <span className="font-medium">{verifyResult.totalStrava}개</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                     <span className="text-gray-500">가져온 활동</span>
                     <span className="font-medium">{verifyResult.totalImported}개</span>
                  </div>
                  {(verifyResult.missingActivityCount > 0 || verifyResult.missingStreamCount > 0) ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg space-y-3">
                       <div className="text-sm text-amber-800 dark:text-amber-200">
                         <strong>{verifyResult.missingActivityCount}개</strong>의 활동과 <strong>{verifyResult.missingStreamCount}개</strong>의 상세 데이터가 누락되었습니다.
                       </div>
                       <button
                         onClick={handleFix}
                         disabled={loading}
                         className="w-full py-2 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors text-sm"
                       >
                         {loading ? "복구 중..." : "누락된 데이터 가져오기"}
                       </button>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-green-600 text-sm font-medium">
                       모든 데이터가 완벽하게 일치합니다!
                    </div>
                  )}
                </div>
             </Section>
           )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
        {value}<span className="text-sm font-normal text-gray-500 ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function formatDurationSimple(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  return `${hours}시간`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function formatEstimate(minutes: number): string {
  if (minutes < 1) return "1분 미만";
  if (minutes < 60) return `${Math.round(minutes)}분`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}시간 ${m}분`;
}
