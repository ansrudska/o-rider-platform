import { useState } from "react";
import { Link } from "react-router-dom";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { firestore } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import type { Activity } from "@shared/types";
import Avatar from "./Avatar";
import RouteMap from "./RouteMap";

interface ActivityCardProps {
  activity: Activity;
  showMap?: boolean;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return new Date(timestamp).toLocaleDateString("ko-KR");
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    minute: "2-digit",
  });
}

// Mock Achievement Types
type AchievementType = "PR" | "KOM" | "2nd" | "3rd";

interface Achievement {
  type: AchievementType;
  segmentName: string;
  time?: string;
}

// Mock Data Generator (Deterministic based on activity ID)
function getMockAchievements(activityId: string): Achievement[] {
  const hash = activityId.split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  const count = hash % 4; // 0 to 3 achievements
  
  if (count === 0) return [];

  const segments = ["남산 업힐", "북악 스카이웨이", "반포 잠수교", "탄천 합수부", "하트코스"];
  const types: AchievementType[] = ["PR", "KOM", "2nd", "3rd"];
  
  return Array.from({ length: count }).map((_, i) => ({
    type: types[(hash + i) % types.length],
    segmentName: segments[(hash + i) % segments.length],
    time: `${Math.floor(5 + i)}:${Math.floor(10 + i * 5)}`,
  }));
}

function AchievementBadge({ type }: { type: AchievementType }) {
  const styles = {
    PR: "bg-orange-100 text-orange-700 border-orange-200",
    KOM: "bg-yellow-100 text-yellow-700 border-yellow-200",
    "2nd": "bg-gray-100 text-gray-700 border-gray-200",
    "3rd": "bg-amber-50 text-amber-700 border-amber-100",
  };

  const icons = {
    PR: "🥇 PR",
    KOM: "👑 KOM",
    "2nd": "🥈 2nd",
    "3rd": "🥉 3rd",
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${styles[type]}`}>
      {icons[type]}
    </span>
  );
}

export default function ActivityCard({
  activity,
  showMap = true,
}: ActivityCardProps) {
  const s = activity.summary;
  const isStrava = (activity as Activity & { source?: string }).source === "strava";
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const [localKudos, setLocalKudos] = useState(activity.kudosCount);

  // Generate mock achievements
  const achievements = getMockAchievements(activity.id).sort((a, b) => {
    const priority: Record<AchievementType, number> = { KOM: 4, PR: 3, "2nd": 2, "3rd": 1 };
    return priority[b.type] - priority[a.type];
  });
  const prCount = achievements.filter(a => a.type === "PR").length;
  const komCount = achievements.filter(a => a.type === "KOM").length;

  const handleToggleKudos = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || !profile) return;
    const kudosDocRef = doc(firestore, "activities", activity.id, "kudos", user.uid);
    if (liked) {
      setLiked(false);
      setLocalKudos((c) => Math.max(0, c - 1));
      await deleteDoc(kudosDocRef);
    } else {
      setLiked(true);
      setLocalKudos((c) => c + 1);
      await setDoc(kudosDocRef, {
        nickname: profile.nickname ?? user.displayName ?? "User",
        profileImage: user.photoURL ?? null,
        createdAt: Date.now(),
      });
      showToast("좋아요를 보냈습니다");
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <Avatar
            name={activity.nickname}
            imageUrl={activity.profileImage}
            size="md"
            userId={activity.userId}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to={`/athlete/${activity.userId}`}
                className="font-semibold text-sm hover:text-orange-600 transition-colors"
              >
                {activity.nickname}
              </Link>
              {isStrava ? (
                <svg className="w-3.5 h-3.5 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
              ) : (
                <img src="/favicon.svg" alt="O-Rider" className="w-3.5 h-3.5" />
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(activity.createdAt)}</span>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(activity.startTime)}</div>
          </div>
        </div>
        {/* Title */}
        {/* Title & Badges */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Link
            to={`/activity/${activity.id}`}
            className="text-base font-bold text-gray-900 dark:text-gray-50 hover:text-orange-600 transition-colors"
          >
            {activity.description || "라이딩"}
          </Link>
          {/* Inline Badges */}
          {(prCount > 0 || komCount > 0) && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {komCount > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">👑 KOM</span>}
              {prCount > 0 && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">🥇 PR {prCount}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Stats row & Segments (Side by Side) */}
      <div className="px-4 pb-3 flex gap-4">
        {/* Left: Stats */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">거리</span>
              <span className="ml-1.5 font-semibold">{(s.distance / 1000).toFixed(1)} km</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">획득고도</span>
              <span className="ml-1.5 font-semibold">{Math.round(s.elevationGain)} m</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">시간</span>
              <span className="ml-1.5 font-semibold">{formatDuration(s.ridingTimeMillis)}</span>
            </div>
          </div>
          <div className="flex gap-6 text-sm mt-1">
            <div>
              <span className="text-gray-500 dark:text-gray-400">평속</span>
              <span className="ml-1.5 font-semibold">{s.averageSpeed.toFixed(1)} km/h</span>
            </div>
            {s.averagePower != null && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">파워</span>
                <span className="ml-1.5 font-semibold">{s.averagePower} W</span>
              </div>
            )}
            {s.averageHeartRate != null && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">심박</span>
                <span className="ml-1.5 font-semibold">{s.averageHeartRate} bpm</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Segment Achievements List */}
        {achievements.length > 0 && (
           <div className="w-[40%] max-w-[200px] flex-shrink-0 border-l border-gray-100 dark:border-gray-800 pl-4 flex flex-col -mt-2">
             <div className="space-y-0.5">
               {achievements.map((ach, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                     <div className="flex items-center gap-1.5 overflow-hidden">
                        <AchievementBadge type={ach.type} />
                        <span className="truncate">{ach.segmentName}</span>
                     </div>
                     <span className="font-mono opacity-80">{ach.time}</span>
                  </div>
               ))}
             </div>
           </div>
        )}
      </div>

      {/* Route map with overlay */}
      {showMap && (
        <Link to={`/activity/${activity.id}`} className="block relative group">
          <RouteMap polyline={activity.thumbnailTrack} height="h-52" rounded={false} />
          {/* Gradient overlay + floating badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-end justify-between">
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-md text-xs font-semibold text-gray-800 dark:text-gray-200 shadow-sm">
                {(s.distance / 1000).toFixed(1)} km
              </span>
              <span className="px-2 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-md text-xs font-semibold text-gray-800 dark:text-gray-200 shadow-sm">
                {formatDuration(s.ridingTimeMillis)}
              </span>
              {s.elevationGain > 0 && (
                <span className="px-2 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-md text-xs font-semibold text-green-700 dark:text-green-400 shadow-sm">
                  ▲ {Math.round(s.elevationGain)}m
                </span>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Footer: kudos + comments */}
      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        {/* Inline like toggle */}
        <button
          onClick={handleToggleKudos}
          disabled={!user}
          className={`flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
            liked ? "text-orange-500" : "hover:text-orange-500"
          }`}
        >
          <svg className="w-4 h-4" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>{localKudos > 0 ? localKudos : "좋아요"}</span>
        </button>
        <Link
          to={`/activity/${activity.id}`}
          className="flex items-center gap-1.5 hover:text-orange-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>{activity.commentCount > 0 ? activity.commentCount : "댓글"}</span>
        </Link>
        {activity.segmentEffortCount > 0 && (
          <span className="flex items-center gap-1.5 ml-auto text-xs text-orange-500">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
              <path d="M2 20L8.5 8l4 6 3.5-5L22 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {activity.segmentEffortCount}개 세그먼트
          </span>
        )}
      </div>
    </div>
  );
}
