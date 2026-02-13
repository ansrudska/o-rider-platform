import type { SegmentEffort } from "@shared/types";
import Avatar from "./Avatar";

interface LeaderboardTableProps {
  efforts: SegmentEffort[];
  highlightUserId?: string;
}

const RANK_BADGES = ["🥇", "🥈", "🥉"];

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function LeaderboardTable({
  efforts,
  highlightUserId,
}: LeaderboardTableProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 font-medium w-14">순위</th>
            <th className="text-left px-4 py-3 font-medium">라이더</th>
            <th className="text-right px-4 py-3 font-medium">시간</th>
            <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
              평속
            </th>
            <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
              심박
            </th>
            <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
              파워
            </th>
            <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">
              날짜
            </th>
          </tr>
        </thead>
        <tbody>
          {efforts.map((e, i) => {
            const isHighlighted = e.userId === highlightUserId;
            return (
              <tr
                key={e.id}
                className={`border-b border-gray-100 last:border-0 ${isHighlighted ? "bg-orange-50" : ""}`}
              >
                <td className="px-4 py-3 font-medium">
                  {i < 3 ? (
                    <span className="text-lg">{RANK_BADGES[i]}</span>
                  ) : (
                    <span className="text-gray-400">{i + 1}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={e.nickname} imageUrl={e.profileImage} size="sm" userId={e.userId} />
                    <span
                      className={`font-medium ${isHighlighted ? "text-orange-600" : ""}`}
                    >
                      {e.nickname}
                    </span>
                  </div>
                </td>
                <td className="text-right px-4 py-3 font-mono font-medium">
                  {formatTime(e.elapsedTime)}
                </td>
                <td className="text-right px-4 py-3 hidden sm:table-cell">
                  {e.averageSpeed.toFixed(1)} km/h
                </td>
                <td className="text-right px-4 py-3 text-red-500 hidden md:table-cell">
                  {e.averageHeartRate ?? "-"}
                </td>
                <td className="text-right px-4 py-3 text-blue-500 hidden sm:table-cell">
                  {e.averagePower ? `${e.averagePower}W` : "-"}
                </td>
                <td className="text-right px-4 py-3 text-gray-500 hidden lg:table-cell">
                  {new Date(e.recordedAt).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
