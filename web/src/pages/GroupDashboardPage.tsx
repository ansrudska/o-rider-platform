import { useParams, Link } from "react-router-dom";
import { where, orderBy, limit } from "firebase/firestore";
import { useCollection } from "../hooks/useFirestore";
import type { GroupRide } from "@shared/types";

export default function GroupDashboardPage() {
  const { groupId } = useParams<{ groupId: string }>();

  const { data: rides, loading } = useCollection<GroupRide>("group_rides", [
    where("groupId", "==", groupId ?? ""),
    orderBy("startTime", "desc"),
    limit(20),
  ]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">그룹 라이딩</h1>
        <span className="text-sm text-gray-500">
          총 {rides.length}회 라이딩
        </span>
      </div>

      {rides.length === 0 ? (
        <p className="text-gray-500 text-center py-12">
          아직 그룹 라이딩 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} groupId={groupId!} />
          ))}
        </div>
      )}
    </div>
  );
}

function RideCard({ ride, groupId }: { ride: GroupRide; groupId: string }) {
  const date = new Date(ride.startTime);
  const dateStr = date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const totalKm = (ride.totalDistance / 1000).toFixed(1);

  return (
    <Link
      to={`/group/${groupId}/ride/${ride.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-orange-300 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{dateStr}</div>
          <div className="text-sm text-gray-500 mt-1">
            {ride.participantCount}명 참가 &middot; 총 {totalKm}km
          </div>
        </div>
        <div className="flex -space-x-2">
          {Object.values(ride.participants)
            .slice(0, 5)
            .map((p, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-xs font-medium text-orange-600"
              >
                {p.nickname.charAt(0)}
              </div>
            ))}
        </div>
      </div>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-lg border border-gray-200 p-4"
        >
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mt-2" />
        </div>
      ))}
    </div>
  );
}
