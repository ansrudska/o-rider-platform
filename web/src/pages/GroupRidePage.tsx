import { useParams } from "react-router-dom";
import { useDocument } from "../hooks/useFirestore";
import type { GroupRide, GroupRideParticipant } from "@shared/types";

export default function GroupRidePage() {
  const { rideId } = useParams<{
    groupId: string;
    rideId: string;
  }>();

  const { data: ride, loading } = useDocument<GroupRide>(
    "group_rides",
    rideId
  );

  if (loading) {
    return <div className="text-center py-12 text-gray-500">로딩 중...</div>;
  }

  if (!ride) {
    return (
      <div className="text-center py-12 text-gray-500">
        라이딩을 찾을 수 없습니다.
      </div>
    );
  }

  const participants = Object.entries(ride.participants);
  const date = new Date(ride.startTime);
  const duration = ride.endTime - ride.startTime;
  const durationStr = formatDuration(duration);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {date.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          그룹 라이딩
        </h1>
        <p className="text-gray-500 mt-1">
          {ride.participantCount}명 &middot;{" "}
          {(ride.totalDistance / 1000).toFixed(1)}km &middot; {durationStr}
        </p>
      </div>

      {/* TODO: Leaflet 경로 지도 */}
      <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center text-gray-400">
        경로 지도 (Leaflet)
      </div>

      {/* 멤버별 비교 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium">라이더</th>
              <th className="text-right px-4 py-3 font-medium">거리</th>
              <th className="text-right px-4 py-3 font-medium">시간</th>
              <th className="text-right px-4 py-3 font-medium">평속</th>
              <th className="text-right px-4 py-3 font-medium">심박</th>
              <th className="text-right px-4 py-3 font-medium">파워</th>
              <th className="text-right px-4 py-3 font-medium">케이던스</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(([userId, p]) => (
              <ParticipantRow key={userId} participant={p} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParticipantRow({
  participant: p,
}: {
  participant: GroupRideParticipant;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-medium text-orange-600">
            {p.nickname.charAt(0)}
          </div>
          <span className="font-medium">{p.nickname}</span>
        </div>
      </td>
      <td className="text-right px-4 py-3">
        {(p.distance / 1000).toFixed(1)}km
      </td>
      <td className="text-right px-4 py-3">
        {formatDuration(p.ridingTimeMillis)}
      </td>
      <td className="text-right px-4 py-3">{p.averageSpeed.toFixed(1)}</td>
      <td className="text-right px-4 py-3 text-red-500">
        {p.averageHeartRate ?? "-"}
      </td>
      <td className="text-right px-4 py-3 text-blue-500">
        {p.averagePower ? `${p.averagePower}W` : "-"}
      </td>
      <td className="text-right px-4 py-3">
        {p.averageCadence ?? "-"}
      </td>
    </tr>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}
