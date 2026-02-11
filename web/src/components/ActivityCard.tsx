import { Link } from "react-router-dom";
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityCard({
  activity,
  showMap = true,
}: ActivityCardProps) {
  const s = activity.summary;
  const isStrava = (activity as Activity & { source?: string }).source === "strava";

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
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
              {isStrava && (
                <svg className="w-3.5 h-3.5 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
              )}
              <span className="text-xs text-gray-400">{timeAgo(activity.createdAt)}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{formatDate(activity.startTime)}</div>
          </div>
        </div>
        {/* Title */}
        <Link
          to={`/activity/${activity.id}`}
          className="text-base font-bold text-gray-900 hover:text-orange-600 transition-colors block mt-2"
        >
          {activity.description || "라이딩"}
        </Link>
      </div>

      {/* Stats row (Strava style) */}
      <div className="px-4 pb-3">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-gray-500">거리</span>
            <span className="ml-1.5 font-semibold">{(s.distance / 1000).toFixed(1)} km</span>
          </div>
          <div>
            <span className="text-gray-500">획득고도</span>
            <span className="ml-1.5 font-semibold">{Math.round(s.elevationGain)} m</span>
          </div>
          <div>
            <span className="text-gray-500">시간</span>
            <span className="ml-1.5 font-semibold">{formatDuration(s.ridingTimeMillis)}</span>
          </div>
        </div>
        {/* Additional stats if available */}
        <div className="flex gap-6 text-sm mt-1">
          <div>
            <span className="text-gray-500">평속</span>
            <span className="ml-1.5 font-semibold">{s.averageSpeed.toFixed(1)} km/h</span>
          </div>
          {s.averagePower != null && (
            <div>
              <span className="text-gray-500">파워</span>
              <span className="ml-1.5 font-semibold">{s.averagePower} W</span>
            </div>
          )}
          {s.averageHeartRate != null && (
            <div>
              <span className="text-gray-500">심박</span>
              <span className="ml-1.5 font-semibold">{s.averageHeartRate} bpm</span>
            </div>
          )}
        </div>
      </div>

      {/* Route map */}
      {showMap && (
        <Link to={`/activity/${activity.id}`} className="block">
          <RouteMap polyline={activity.thumbnailTrack} height="h-52" rounded={false} />
        </Link>
      )}

      {/* Footer: kudos + comments */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-4 text-sm text-gray-500">
        <Link to={`/activity/${activity.id}`} className="flex items-center gap-1.5 hover:text-orange-500 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>{activity.kudosCount > 0 ? activity.kudosCount : "좋아요"}</span>
        </Link>
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
          <span className="flex items-center gap-1 ml-auto text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {activity.segmentEffortCount}개 세그먼트
          </span>
        )}
      </div>
    </div>
  );
}
