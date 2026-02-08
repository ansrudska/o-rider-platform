import { useParams } from "react-router-dom";
import { where, orderBy, limit } from "firebase/firestore";
import { useCollection } from "../hooks/useFirestore";
import type { Activity } from "@shared/types";

export default function AthletePage() {
  const { userId } = useParams<{ userId: string }>();

  const { data: activities, loading } = useCollection<Activity>("activities", [
    where("userId", "==", userId ?? ""),
    orderBy("createdAt", "desc"),
    limit(20),
  ]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">로딩 중...</div>;
  }

  // 통계 계산
  const totalDistance = activities.reduce(
    (sum, a) => sum + (a.summary?.distance ?? 0),
    0
  );
  const totalTime = activities.reduce(
    (sum, a) => sum + (a.summary?.ridingTimeMillis ?? 0),
    0
  );
  const totalElevation = activities.reduce(
    (sum, a) => sum + (a.summary?.elevationGain ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">프로필</h1>

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="활동" value={`${activities.length}회`} />
        <StatCard label="총 거리" value={`${(totalDistance / 1000).toFixed(0)}km`} />
        <StatCard label="총 시간" value={formatHours(totalTime)} />
        <StatCard label="총 획득고도" value={`${totalElevation.toFixed(0)}m`} />
      </div>

      {/* 활동 목록 */}
      <div className="space-y-3">
        {activities.map((activity) => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  const date = new Date(activity.startTime);
  const s = activity.summary;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {activity.description || "라이딩"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {date.toLocaleDateString("ko-KR")} &middot;{" "}
            {date.toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {activity.kudosCount > 0 && <span>{activity.kudosCount} kudos</span>}
          {activity.commentCount > 0 && (
            <span>{activity.commentCount} 댓글</span>
          )}
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
          <div>
            <span className="text-gray-500">거리</span>
            <div className="font-medium">
              {(s.distance / 1000).toFixed(1)}km
            </div>
          </div>
          <div>
            <span className="text-gray-500">평속</span>
            <div className="font-medium">{s.averageSpeed.toFixed(1)}km/h</div>
          </div>
          <div>
            <span className="text-gray-500">획득고도</span>
            <div className="font-medium">{s.elevationGain}m</div>
          </div>
          <div>
            <span className="text-gray-500">시간</span>
            <div className="font-medium">
              {formatHours(s.ridingTimeMillis)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatHours(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
