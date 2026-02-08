import { useParams } from "react-router-dom";
import { orderBy, limit } from "firebase/firestore";
import { useDocument, useCollection } from "../hooks/useFirestore";
import type { Segment, SegmentEffort } from "@shared/types";

export default function SegmentPage() {
  const { segmentId } = useParams<{ segmentId: string }>();

  const { data: segment, loading: segLoading } = useDocument<Segment>(
    "segments",
    segmentId
  );

  const { data: efforts, loading: effortsLoading } =
    useCollection<SegmentEffort>(
      `segment_efforts/${segmentId ?? "_"}/efforts`,
      [orderBy("elapsedTime", "asc"), limit(50)]
    );

  if (segLoading) {
    return <div className="text-center py-12 text-gray-500">로딩 중...</div>;
  }

  if (!segment) {
    return (
      <div className="text-center py-12 text-gray-500">
        세그먼트를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{segment.name}</h1>
          {segment.climbCategory && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
              Cat {segment.climbCategory}
            </span>
          )}
        </div>
        <p className="text-gray-500 mt-1">
          {(segment.distance / 1000).toFixed(2)}km &middot; 획득고도{" "}
          {segment.elevationGain}m &middot; 평균경사{" "}
          {segment.averageGrade.toFixed(1)}%
        </p>
      </div>

      {/* KOM / QOM */}
      <div className="grid grid-cols-2 gap-4">
        <RecordCard label="KOM" record={segment.kom} />
        <RecordCard label="QOM" record={segment.qom} />
      </div>

      {/* TODO: Leaflet 세그먼트 지도 */}
      <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400">
        세그먼트 경로 (Leaflet)
      </div>

      {/* 리더보드 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 font-medium">
          리더보드
        </div>
        {effortsLoading ? (
          <div className="p-4 text-gray-500 text-center">로딩 중...</div>
        ) : efforts.length === 0 ? (
          <div className="p-4 text-gray-500 text-center">
            아직 기록이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium w-12">#</th>
                <th className="text-left px-4 py-2 font-medium">라이더</th>
                <th className="text-right px-4 py-2 font-medium">시간</th>
                <th className="text-right px-4 py-2 font-medium">평속</th>
                <th className="text-right px-4 py-2 font-medium">파워</th>
                <th className="text-right px-4 py-2 font-medium">날짜</th>
              </tr>
            </thead>
            <tbody>
              {efforts.map((e, i) => (
                <tr
                  key={e.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-2 font-medium text-gray-400">
                    {i + 1}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.nickname}</td>
                  <td className="text-right px-4 py-2">
                    {formatTime(e.elapsedTime)}
                  </td>
                  <td className="text-right px-4 py-2">
                    {e.averageSpeed.toFixed(1)}
                  </td>
                  <td className="text-right px-4 py-2 text-blue-500">
                    {e.averagePower ? `${e.averagePower}W` : "-"}
                  </td>
                  <td className="text-right px-4 py-2 text-gray-500">
                    {new Date(e.recordedAt).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RecordCard({
  label,
  record,
}: {
  label: string;
  record: Segment["kom"];
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      {record ? (
        <>
          <div className="text-xl font-bold mt-1">
            {formatTime(record.time)}
          </div>
          <div className="text-sm text-gray-600">{record.nickname}</div>
        </>
      ) : (
        <div className="text-sm text-gray-400 mt-1">기록 없음</div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
