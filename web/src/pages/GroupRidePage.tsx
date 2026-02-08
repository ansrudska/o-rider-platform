import { useParams, Link } from "react-router-dom";
import MapPlaceholder from "../components/MapPlaceholder";
import Avatar from "../components/Avatar";
import StatCard from "../components/StatCard";
import ComparisonChart from "../components/ComparisonChart";
import { groupRides } from "../data/demo";
import type { GroupRideParticipant } from "@shared/types";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

export default function GroupRidePage() {
  const { groupId, rideId } = useParams<{
    groupId: string;
    rideId: string;
  }>();

  const ride = groupRides.find((r) => r.id === rideId);

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

  // Comparison chart data
  const names = participants.map(([, p]) => p.nickname);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500">
        <Link
          to={`/group/${groupId}`}
          className="hover:text-orange-600 transition-colors"
        >
          그룹 대시보드
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">라이딩 상세</span>
      </div>

      {/* Header */}
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
          {(ride.totalDistance / 1000).toFixed(1)}km &middot;{" "}
          {formatDuration(duration)}
        </p>
      </div>

      {/* Map */}
      <MapPlaceholder height="h-72" label="그룹 경로 지도" />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="참가자"
          value={`${ride.participantCount}명`}
          icon="👥"
        />
        <StatCard
          label="총 거리"
          value={`${(ride.totalDistance / 1000).toFixed(1)}km`}
          icon="📏"
        />
        <StatCard
          label="소요 시간"
          value={formatDuration(duration)}
          icon="⏱"
        />
        <StatCard
          label="평균 거리"
          value={`${(ride.totalDistance / 1000 / ride.participantCount).toFixed(1)}km`}
          icon="📊"
        />
      </div>

      {/* Participant cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">멤버별 성과</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {participants.map(([userId, p]) => (
            <ParticipantCard key={userId} userId={userId} participant={p} />
          ))}
        </div>
      </div>

      {/* Comparison charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            속도 비교
          </h3>
          <ComparisonChart
            labels={names}
            datasets={[
              {
                label: "평균 속도",
                data: participants.map(([, p]) => Number(p.averageSpeed.toFixed(1))),
                color: "rgba(59, 130, 246, 0.7)",
              },
            ]}
            unit=" km/h"
            height={180}
          />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            파워/심박 비교
          </h3>
          <ComparisonChart
            labels={names}
            datasets={[
              {
                label: "파워 (W)",
                data: participants.map(([, p]) => p.averagePower ?? 0),
                color: "rgba(168, 85, 247, 0.7)",
              },
              {
                label: "심박 (bpm)",
                data: participants.map(
                  ([, p]) => p.averageHeartRate ?? 0,
                ),
                color: "rgba(239, 68, 68, 0.5)",
              },
            ]}
            height={180}
          />
        </div>
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium">라이더</th>
              <th className="text-right px-4 py-3 font-medium">거리</th>
              <th className="text-right px-4 py-3 font-medium">시간</th>
              <th className="text-right px-4 py-3 font-medium">평속</th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                심박
              </th>
              <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                파워
              </th>
              <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                케이던스
              </th>
            </tr>
          </thead>
          <tbody>
            {participants.map(([userId, p]) => (
              <tr
                key={userId}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/athlete/${userId}`}
                    className="flex items-center gap-2 hover:text-orange-600"
                  >
                    <Avatar name={p.nickname} size="sm" />
                    <span className="font-medium">{p.nickname}</span>
                  </Link>
                </td>
                <td className="text-right px-4 py-3">
                  {(p.distance / 1000).toFixed(1)}km
                </td>
                <td className="text-right px-4 py-3">
                  {formatDuration(p.ridingTimeMillis)}
                </td>
                <td className="text-right px-4 py-3">
                  {p.averageSpeed.toFixed(1)}
                </td>
                <td className="text-right px-4 py-3 text-red-500 hidden sm:table-cell">
                  {p.averageHeartRate ?? "-"}
                </td>
                <td className="text-right px-4 py-3 text-blue-500 hidden sm:table-cell">
                  {p.averagePower ? `${p.averagePower}W` : "-"}
                </td>
                <td className="text-right px-4 py-3 hidden md:table-cell">
                  {p.averageCadence ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParticipantCard({
  userId,
  participant: p,
}: {
  userId: string;
  participant: GroupRideParticipant;
}) {
  return (
    <Link
      to={`/athlete/${userId}`}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-colors"
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={p.nickname} size="md" />
        <span className="font-semibold">{p.nickname}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-xs text-gray-500">거리</div>
          <div className="font-medium">
            {(p.distance / 1000).toFixed(1)}km
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">평속</div>
          <div className="font-medium">{p.averageSpeed.toFixed(1)} km/h</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">심박</div>
          <div className="font-medium text-red-500">
            {p.averageHeartRate ?? "-"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">파워</div>
          <div className="font-medium text-blue-500">
            {p.averagePower ? `${p.averagePower}W` : "-"}
          </div>
        </div>
      </div>
    </Link>
  );
}
