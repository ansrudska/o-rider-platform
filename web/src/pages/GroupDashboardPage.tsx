import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import TabNav from "../components/TabNav";
import Avatar from "../components/Avatar";
import StatCard from "../components/StatCard";
import ComparisonChart from "../components/ComparisonChart";
import {
  groups,
  getGroupRidesForGroup,
  riders,
  riderMap,
  activities,
} from "../data/demo";

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function GroupDashboardPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [activeTab, setActiveTab] = useState("rides");

  const group = groups.find((g) => g.id === groupId);
  const groupRidesList = getGroupRidesForGroup(groupId ?? "");

  if (!group) {
    return (
      <div className="text-center py-12 text-gray-500">
        그룹을 찾을 수 없습니다.
      </div>
    );
  }

  // Leaderboard: total distance per member
  const memberStats = group.members.map((memberId) => {
    const memberActivities = activities.filter(
      (a) => a.userId === memberId && a.groupId === groupId,
    );
    const totalDist = memberActivities.reduce(
      (s, a) => s + a.summary.distance,
      0,
    );
    const totalTime = memberActivities.reduce(
      (s, a) => s + a.summary.ridingTimeMillis,
      0,
    );
    const rider = riderMap[memberId]!;
    return { ...rider, totalDist, totalTime, rides: memberActivities.length };
  });
  memberStats.sort((a, b) => b.totalDist - a.totalDist);

  const tabs = [
    { id: "rides", label: "라이딩", count: groupRidesList.length },
    { id: "leaderboard", label: "리더보드" },
    { id: "members", label: "멤버", count: group.memberCount },
  ];

  return (
    <div className="space-y-6">
      {/* Group header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
            <p className="text-gray-500 mt-1 text-sm">{group.description}</p>
          </div>
          <div className="flex -space-x-2">
            {group.members.slice(0, 5).map((memberId) => (
              <Avatar
                key={memberId}
                name={riderMap[memberId]!.nickname}
                size="md"
                userId={memberId}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <StatCard
            label="멤버"
            value={`${group.memberCount}명`}
            icon="👥"
          />
          <StatCard
            label="총 거리"
            value={`${(group.totalDistance / 1000).toFixed(0)}km`}
            icon="📏"
          />
          <StatCard
            label="총 라이딩"
            value={`${group.totalRides}회`}
            icon="🚴"
          />
        </div>
      </div>

      <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Rides tab */}
      {activeTab === "rides" && (
        <div className="space-y-3">
          {groupRidesList.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              아직 그룹 라이딩 기록이 없습니다.
            </p>
          ) : (
            groupRidesList.map((ride) => {
              const date = new Date(ride.startTime);
              const participants = Object.entries(ride.participants);
              return (
                <Link
                  key={ride.id}
                  to={`/group/${groupId}/ride/${ride.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {date.toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          weekday: "short",
                        })}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {ride.participantCount}명 참가 &middot; 총{" "}
                        {(ride.totalDistance / 1000).toFixed(1)}km &middot;{" "}
                        {formatDuration(ride.endTime - ride.startTime)}
                      </div>
                    </div>
                    <div className="flex -space-x-2">
                      {participants.slice(0, 5).map(([userId, p]) => (
                        <Avatar key={userId} name={p.nickname} size="sm" />
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* Leaderboard tab */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <ComparisonChart
            labels={memberStats.map((m) => m.nickname)}
            datasets={[
              {
                label: "거리 (km)",
                data: memberStats.map((m) =>
                  Math.round(m.totalDist / 1000),
                ),
                color: "rgba(249, 115, 22, 0.7)",
              },
            ]}
            height={250}
            unit=" km"
          />

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium w-12">
                    순위
                  </th>
                  <th className="text-left px-4 py-3 font-medium">멤버</th>
                  <th className="text-right px-4 py-3 font-medium">거리</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                    시간
                  </th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                    라이딩
                  </th>
                </tr>
              </thead>
              <tbody>
                {memberStats.map((m, i) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">
                      {i < 3 ? (
                        <span className="text-lg">
                          {["🥇", "🥈", "🥉"][i]}
                        </span>
                      ) : (
                        <span className="text-gray-400">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/athlete/${m.id}`}
                        className="flex items-center gap-2"
                      >
                        <Avatar name={m.nickname} size="sm" />
                        <span className="font-medium">{m.nickname}</span>
                      </Link>
                    </td>
                    <td className="text-right px-4 py-3 font-medium">
                      {(m.totalDist / 1000).toFixed(1)} km
                    </td>
                    <td className="text-right px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {formatDuration(m.totalTime)}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-500 hidden sm:table-cell">
                      {m.rides}회
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Members tab */}
      {activeTab === "members" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {riders
            .filter((r) => group.members.includes(r.id))
            .map((rider) => {
              const riderActs = activities.filter(
                (a) => a.userId === rider.id,
              );
              const lastActivity = riderActs[0];
              return (
                <Link
                  key={rider.id}
                  to={`/athlete/${rider.id}`}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={rider.nickname} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{rider.nickname}</div>
                      <div className="text-xs text-gray-500">{rider.bio}</div>
                      {lastActivity && (
                        <div className="text-xs text-gray-400 mt-1">
                          최근: {lastActivity.description} &middot;{" "}
                          {(
                            lastActivity.summary.distance / 1000
                          ).toFixed(1)}
                          km
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
