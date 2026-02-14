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
import Avatar from "../components/Avatar";

// --- Components ---

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden ${className}`}>
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          {title}
        </h2>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function SectionRow({ label, description, children, className = "" }: { label: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 ${className}`}>
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
        {description && <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

// --- Icons ---
const Icons = {
  ChevronRight: () => <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  Check: () => <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  Copy: () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Strava: () => <svg className="w-5 h-5 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>,
  Share: () => <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
};

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
    if (!user || !database) return;
    get(ref(database, `users/${user.uid}/friendCode`)).then((snap) => {
      if (snap.exists()) setFriendCode(snap.val());
    });
  }, [user]);

  if (!user) return <div className="text-center py-12 text-gray-500">로그인이 필요합니다.</div>;

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed || !user) return;
    setNicknameSaving(true);
    try {
      await updateDoc(doc(firestore, "users", user.uid), { nickname: trimmed });
      const activitiesSnap = await getDocs(query(collection(firestore, "activities"), where("userId", "==", user.uid)));
      if (!activitiesSnap.empty) {
        const batch = writeBatch(firestore);
        activitiesSnap.docs.forEach((d) => batch.update(d.ref, { nickname: trimmed }));
        await batch.commit();
      }
      showToast("닉네임철 변경되었습니다");
      setEditingNickname(false);
    } finally {
      setNicknameSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Strava 연동을 해제하시겠습니까?")) return;
    try {
      await disconnectStrava();
      showToast("연동이 해제되었습니다");
    } catch {}
  };

  const handleDeleteData = async () => {
    if (!window.confirm("모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setDeleteResult(null);
      const result = await deleteUserData();
      setDeleteResult(result);
      showToast("데이터가 삭제되었습니다");
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">설정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">계정 정보 및 연동 상태를 관리합니다.</p>
      </div>

      {/* 1. Profile Section */}
      <Section title="프로필">
        <div className="flex items-center gap-5 mb-6">
          <Avatar 
            name={profile?.nickname ?? user.displayName} 
            imageUrl={user.photoURL ?? undefined} 
            size="xl" 
            userId={user.uid}
          />
          <div className="flex-1 space-y-1">
             {editingNickname ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSaveNickname();
                    if (e.key === "Escape") setEditingNickname(false);
                  }}
                  autoFocus
                  className="px-2 py-1 text-base font-bold border-b-2 border-orange-500 bg-transparent focus:outline-none w-40"
                />
                <div className="flex items-center gap-1">
                  <button onClick={handleSaveNickname} disabled={nicknameSaving} className="text-xs bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600">저장</button>
                  <button onClick={() => setEditingNickname(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2">취소</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{profile?.nickname ?? user.displayName}</h3>
                <button 
                  onClick={() => { setNicknameInput(profile?.nickname ?? user.displayName ?? ""); setEditingNickname(true); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-orange-500"
                >
                  수정
                </button>
              </div>
            )}
            <div className="text-sm text-gray-500">{user.email}</div>
          </div>
        </div>

        <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-800">
           {friendCode && (
            <SectionRow label="친구 코드" description="친구 검색에 사용되는 고유 코드입니다.">
             <div className="flex items-center gap-2">
              <button 
                onClick={() => { navigator.clipboard.writeText(friendCode); showToast("복사되었습니다"); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                {friendCode}
                <Icons.Copy />
              </button>
              <button 
                onClick={() => {
                  const profileUrl = window.location.origin + `/athlete/${user.uid}?action=invite`;
                  const text = `O-Rider에서 같이 라이딩해요! 🚴\n제 친구 코드는 [${friendCode}] 입니다.\n${profileUrl}`;
                  if (navigator.share) {
                    navigator.share({
                      title: 'O-Rider 친구 초대',
                      text: text,
                      url: profileUrl
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text);
                    showToast("초대 메시지가 복사되었습니다");
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-sm font-medium hover:bg-orange-100 dark:hover:bg-orange-900/40 transition"
              >
                <Icons.Share />
                초대하기
              </button>
             </div>
            </SectionRow>
          )}

          <SectionRow label="기본 공개 범위" description="새로 동기화되는 활동의 공개 범위를 설정합니다.">
             <div className="flex items-center gap-2">
                {([
                  { value: "everyone", label: "전체" },
                  { value: "friends", label: "친구" },
                  { value: "private", label: "비공개" },
                ] as const).map((opt) => {
                  const isActive = (selectedVisibility ?? currentVisibility) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setSelectedVisibility(opt.value); setVisibilityResult(null); }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                        isActive 
                        ? "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-900/50 dark:text-orange-400" 
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
             </div>
          </SectionRow>
          {selectedVisibility && selectedVisibility !== currentVisibility && (
             <div className="flex justify-end pb-4">
                <button
                  onClick={async () => {
                    setVisibilitySaving(true);
                    try {
                      const fn = httpsCallable<{ visibility: string }, { updated: number }>(functions, "updateDefaultVisibility");
                      await fn({ visibility: selectedVisibility });
                      showToast("공개 범위가 변경되었습니다");
                      setSelectedVisibility(null);
                    } catch {
                      showToast("변경 실패");
                    } finally {
                      setVisibilitySaving(false);
                    }
                  }}
                  disabled={visibilitySaving}
                  className="text-sm text-orange-600 font-medium hover:text-orange-700"
                >
                  {visibilitySaving ? "저장 중..." : "변경사항 저장"}
                </button>
             </div>
          )}
        </div>
      </Section>

      {/* 2. Integrations Section */}
      <Section title="연동 관리">
        <div className="py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FC4C02]/10 rounded-lg flex items-center justify-center">
                <Icons.Strava />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  Strava
                  {profile?.stravaConnected && <span className="inline-flex w-1.5 h-1.5 bg-green-500 rounded-full" />}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {profile?.stravaConnected 
                    ? `연결됨 (${profile.stravaNickname})` 
                    : "스트라바 활동을 자동으로 동기화합니다."}
                </div>
              </div>
            </div>
            
            {profile?.stravaConnected ? (
               <button 
                 onClick={handleDisconnect}
                 className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 rounded-lg transition-colors"
               >
                 해제
               </button>
            ) : (
              <button 
                onClick={() => connectStrava()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#FC4C02] rounded-lg hover:bg-[#E34402] transition-colors shadow-sm"
              >
                연결하기
              </button>
            )}
          </div>

          {profile?.stravaConnected && (
            <div className="mt-6 pl-13 border-t border-gray-50 dark:border-gray-800 pt-4 space-y-3">
              <div className="flex gap-2">
                 <Link to="/migrate" className="flex-1">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-orange-200 dark:hover:border-orange-900/50 bg-gray-50 dark:bg-gray-800/50 transition-colors group">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {profile?.migration?.status === "DONE" ? "마이그레이션 리포트" : "데이터 가져오기"}
                      </div>
                      <div className="group-hover:translate-x-1 transition-transform">
                        <Icons.ChevronRight />
                      </div>
                    </div>
                 </Link>
                 <button 
                   onClick={async () => {
                      if (!window.confirm("캐시를 초기화하시겠습니까? (이미지는 다시 로드됩니다)")) return;
                      await deleteUserData(true);
                      showToast("캐시가 초기화되었습니다");
                   }}
                   disabled={loading}
                   className="px-3 rounded-lg border border-gray-100 dark:border-gray-800 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                 >
                   캐시 초기화
                 </button>
              </div>
            </div>
          )}
          {error && <div className="mt-4 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        </div>
      </Section>

      {/* 3. Data Management */}
      <Section title="데이터 관리">
         <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">내 데이터 다운로드</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">GPX 파일과 활동 기록을 ZIP으로 받습니다.</div>
              </div>
              <button
                onClick={exportData}
                disabled={exportLoading}
                className="px-3 py-1.5 text-xs font-medium border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {exportLoading ? "준비 중..." : "다운로드 요청"}
              </button>
            </div>
            {exportProgress && (
               <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                 <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                   <span>{exportProgress.label}</span>
                   <span>{Math.round((exportProgress.current / (exportProgress.total || 1)) * 100)}%</span>
                 </div>
                 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                   <div className="bg-orange-500 h-full transition-all duration-500" style={{ width: `${(exportProgress.current / (exportProgress.total || 1)) * 100}%` }} />
                 </div>
               </div>
            )}
         </div>
      </Section>

      {/* 4. Danger Zone */}
      <div className="border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden">
        <div className="bg-red-50 dark:bg-red-900/10 px-6 py-3 border-b border-red-100 dark:border-red-900/30">
          <h2 className="text-sm font-bold text-red-800 dark:text-red-400">위험 구역</h2>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900">
           <SectionRow 
             label="데이터 삭제" 
             description="Strava에서 가져온 모든 활동 데이터를 삭제합니다. O-Rider에서 생성된 소셜 데이터(댓글 등)는 유지될 수 있습니다."
           >
             <button
                onClick={handleDeleteData}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                데이터 삭제
              </button>
           </SectionRow>
        </div>
      </div>
    </div>
  );
}
