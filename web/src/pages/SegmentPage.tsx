import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { firestore } from "../services/firebase";
import { useDocument } from "../hooks/useFirestore";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import RouteMap from "../components/RouteMap";
import Avatar from "../components/Avatar";

const CATEGORY_COLORS: Record<number, { bg: string; label: string }> = {
  5: { bg: "bg-red-600 text-white", label: "HC" },
  4: { bg: "bg-red-500 text-white", label: "Cat 1" },
  3: { bg: "bg-orange-500 text-white", label: "Cat 2" },
  2: { bg: "bg-yellow-500 text-white", label: "Cat 3" },
  1: { bg: "bg-green-500 text-white", label: "Cat 4" },
};

const RANK_STYLES = [
  "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 shadow-sm",
  "bg-gradient-to-r from-slate-300 to-slate-400 text-white shadow-sm",
  "bg-gradient-to-r from-orange-300 to-orange-400 text-white shadow-sm",
];

interface SegmentData {
  id: string;
  name: string;
  distance: number;
  averageGrade: number;
  maximumGrade: number;
  elevationHigh: number;
  elevationLow: number;
  climbCategory: number;
  city?: string;
  state?: string;
  startLatlng?: [number, number] | null;
  endLatlng?: [number, number] | null;
  segmentLatlng?: string | null;
  source?: string;
}

interface EffortData {
  id: string;
  segmentId: string;
  activityId: string;
  userId: string;
  nickname: string;
  profileImage?: string | null;
  elapsedTime: number;
  movingTime: number;
  distance: number;
  averageSpeed: number;
  averageWatts: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  prRank: number | null;
  komRank: number | null;
  startDate: number;
  source?: string;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SegmentPage() {
  const { segmentId } = useParams<{ segmentId: string }>();
  const { user, profile } = useAuth();
  const { getStreams } = useStrava();
  const { data: segment, loading: segLoading } = useDocument<SegmentData>("segments", segmentId);

  const [efforts, setEfforts] = useState<EffortData[]>([]);
  const [loadingEfforts, setLoadingEfforts] = useState(true);
  const [resolvedLatlng, setResolvedLatlng] = useState<[number, number][] | null>(null);
  const fetchedRef = useRef(false);

  // Fetch efforts sorted by elapsedTime (leaderboard)
  useEffect(() => {
    if (!segmentId) return;

    const fetchEfforts = async () => {
      setLoadingEfforts(true);
      try {
        const q = query(
          collection(firestore, `segment_efforts/${segmentId}/efforts`),
          orderBy("elapsedTime", "asc"),
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EffortData);

        // Deduplicate: keep best effort per user
        const bestByUser = new Map<string, EffortData>();
        for (const e of items) {
          const existing = bestByUser.get(e.userId);
          if (!existing || e.elapsedTime < existing.elapsedTime) {
            bestByUser.set(e.userId, e);
          }
        }
        setEfforts(Array.from(bestByUser.values()).sort((a, b) => a.elapsedTime - b.elapsedTime));
      } catch (err) {
        console.error("Failed to fetch efforts:", err);
      } finally {
        setLoadingEfforts(false);
      }
    };

    fetchEfforts();
  }, [segmentId]);

  // Auto-resolve segment route: if segmentLatlng is missing, fetch activity streams to populate it
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!segment || (segment.segmentLatlng && segment.segmentLatlng.length > 2)) return;
    if (!user || !profile?.stravaConnected) return;
    if (efforts.length === 0 || loadingEfforts) return;

    // Find an effort with a strava activityId
    const effort = efforts.find((e) => e.activityId?.startsWith("strava_"));
    if (!effort) return;

    const stravaId = parseInt(effort.activityId.replace("strava_", ""), 10);
    if (!stravaId) return;

    fetchedRef.current = true;
    // getStreams triggers stravaGetActivityStreams which saves segmentLatlng as side-effect
    getStreams(stravaId).then((data) => {
      // Extract segment route from streams for immediate display
      const streams = data as { latlng?: [number, number][]; segment_efforts?: { segment: { id: number }; startIndex: number; endIndex: number }[] };
      if (!streams?.latlng || !streams?.segment_efforts) return;

      const stravaSegId = segment.source === "strava" ? (segment as SegmentData & { stravaSegmentId?: number }).stravaSegmentId : null;
      if (!stravaSegId) return;

      const matchingEffort = streams.segment_efforts.find((e) => e.segment.id === stravaSegId);
      if (!matchingEffort) return;

      const slice = streams.latlng.slice(matchingEffort.startIndex, matchingEffort.endIndex + 1);
      if (slice.length > 0) setResolvedLatlng(slice);
    }).catch(() => {});
  }, [segment, user, profile?.stravaConnected, efforts, loadingEfforts]);

  // My all efforts (for personal history)
  const [allEfforts, setAllEfforts] = useState<EffortData[]>([]);
  const [showAllEfforts, setShowAllEfforts] = useState(false);

  useEffect(() => {
    if (!segmentId || !user || !showAllEfforts) return;

    const fetchMyEfforts = async () => {
      try {
        const q = query(
          collection(firestore, `segment_efforts/${segmentId}/efforts`),
          orderBy("startDate", "desc"),
        );
        const snap = await getDocs(q);
        setAllEfforts(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as EffortData)
            .filter((e) => e.userId === user.uid),
        );
      } catch (err) {
        console.error("Failed to fetch all efforts:", err);
      }
    };

    fetchMyEfforts();
  }, [segmentId, user, showAllEfforts]);

  // Segment stats
  const elevGain = useMemo(
    () => (segment ? Math.max(0, segment.elevationHigh - segment.elevationLow) : 0),
    [segment],
  );

  const komEffort = efforts[0] ?? null;
  const myBestEffort = useMemo(
    () => (user ? efforts.find((e) => e.userId === user.uid) : null),
    [efforts, user],
  );
  const myRank = useMemo(
    () => (user ? efforts.findIndex((e) => e.userId === user.uid) + 1 : 0),
    [efforts, user],
  );

  if (segLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!segment) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">세그먼트를 찾을 수 없습니다.</p>
        <Link to="/" className="text-orange-600 hover:underline text-sm mt-2 inline-block">홈으로 돌아가기</Link>
      </div>
    );
  }

  const cat = CATEGORY_COLORS[segment.climbCategory];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Map */}
      {(() => {
        const parsed: [number, number][] | null = segment.segmentLatlng
          ? JSON.parse(segment.segmentLatlng)
          : null;
        const latlng = (parsed && parsed.length > 0)
          ? parsed
          : resolvedLatlng
            ? resolvedLatlng
            : (segment.startLatlng && segment.endLatlng)
              ? [segment.startLatlng, segment.endLatlng]
              : null;
        return latlng && (
          <RouteMap
            latlng={latlng}
            height="h-[28rem]"
            interactive
            rounded
          />
        );
      })()}

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-3 flex-wrap">
          {cat && (
            <span className={`px-2.5 py-1 text-xs font-bold rounded ${cat.bg}`}>
              {cat.label}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{segment.name}</h1>
        </div>
        {(segment.city || segment.state) && (
          <p className="text-sm text-gray-500 mt-1">
            {[segment.city, segment.state].filter(Boolean).join(", ")}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div>
            <div className="text-xs text-gray-500">거리</div>
            <div className="text-lg font-semibold">{(segment.distance / 1000).toFixed(2)} km</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">획득고도</div>
            <div className="text-lg font-semibold">{Math.round(elevGain)} m</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">평균경사</div>
            <div className="text-lg font-semibold">{segment.averageGrade.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">최대경사</div>
            <div className="text-lg font-semibold">{segment.maximumGrade.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      {/* KOM + My Best */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* KOM */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-2">KOM/QOM</div>
          {komEffort ? (
            <div className="flex items-center gap-3">
              <Avatar name={komEffort.nickname} imageUrl={komEffort.profileImage} size="md" userId={komEffort.userId} />
              <div className="flex-1">
                <Link to={`/athlete/${komEffort.userId}`} className="font-semibold text-sm hover:text-orange-600">
                  {komEffort.nickname}
                </Link>
                <div className="text-2xl font-bold text-orange-600 font-mono">{formatTime(komEffort.elapsedTime)}</div>
                <div className="text-xs text-gray-500">
                  {komEffort.averageSpeed.toFixed(1)} km/h
                  {komEffort.averageWatts != null && ` · ${komEffort.averageWatts}W`}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">기록 없음</div>
          )}
        </div>

        {/* My Best */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 font-medium mb-2">내 최고 기록</div>
          {myBestEffort ? (
            <div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold text-gray-900 font-mono">{formatTime(myBestEffort.elapsedTime)}</div>
                {myRank > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    myRank <= 3 ? RANK_STYLES[myRank - 1] : "bg-gray-100 text-gray-600"
                  }`}>
                    #{myRank}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {myBestEffort.averageSpeed.toFixed(1)} km/h
                {myBestEffort.averageWatts != null && ` · ${myBestEffort.averageWatts}W`}
                {myBestEffort.averageHeartrate != null && ` · ${Math.round(myBestEffort.averageHeartrate)} bpm`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(myBestEffort.startDate).toLocaleDateString("ko-KR")}
              </div>
            </div>
          ) : user ? (
            <div className="text-sm text-gray-400">아직 기록 없음</div>
          ) : (
            <div className="text-sm text-gray-400">로그인하면 내 기록을 확인할 수 있습니다</div>
          )}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            리더보드 ({efforts.length}명)
          </h2>
        </div>

        {loadingEfforts ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : efforts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">아직 기록이 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left px-4 py-2.5 font-medium w-12">#</th>
                <th className="text-left px-4 py-2.5 font-medium">라이더</th>
                <th className="text-right px-4 py-2.5 font-medium">시간</th>
                <th className="text-right px-4 py-2.5 font-medium hidden sm:table-cell">평속</th>
                <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">파워</th>
                <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">심박</th>
                <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">날짜</th>
              </tr>
            </thead>
            <tbody>
              {efforts.map((effort, i) => {
                const isMe = user?.uid === effort.userId;
                const rank = i + 1;
                return (
                  <tr
                    key={effort.id}
                    className={`border-b border-gray-100 last:border-0 ${isMe ? "bg-orange-50" : "hover:bg-gray-50"} transition-colors`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {rank <= 3 ? (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${RANK_STYLES[rank - 1]}`}>
                          {rank}
                        </span>
                      ) : (
                        <span className="text-gray-400">{rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={effort.nickname || "Rider"} imageUrl={effort.profileImage} size="sm" userId={effort.userId} />
                        <Link
                          to={`/athlete/${effort.userId}`}
                          className={`font-medium hover:text-orange-600 ${isMe ? "text-orange-600" : ""}`}
                        >
                          {effort.nickname || "Rider"}
                          {isMe && <span className="text-xs text-gray-400 ml-1">(나)</span>}
                        </Link>
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-mono font-semibold">
                      {formatTime(effort.elapsedTime)}
                    </td>
                    <td className="text-right px-4 py-3 hidden sm:table-cell">
                      {effort.averageSpeed.toFixed(1)} km/h
                    </td>
                    <td className="text-right px-4 py-3 text-purple-600 hidden md:table-cell">
                      {effort.averageWatts != null ? `${effort.averageWatts}W` : "-"}
                    </td>
                    <td className="text-right px-4 py-3 text-red-500 hidden md:table-cell">
                      {effort.averageHeartrate != null ? `${Math.round(effort.averageHeartrate)}` : "-"}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-500 hidden lg:table-cell">
                      {new Date(effort.startDate).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* My History */}
      {user && myBestEffort && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowAllEfforts(!showAllEfforts)}
            className="w-full px-5 py-3 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="font-semibold text-sm">내 기록 히스토리</h2>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showAllEfforts ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAllEfforts && (
            <div className="divide-y divide-gray-100">
              {allEfforts.length === 0 ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                allEfforts.map((effort) => {
                  const isBest = effort.id === myBestEffort.id;
                  return (
                    <div key={effort.id} className={`px-5 py-3 flex items-center justify-between ${isBest ? "bg-orange-50" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">{new Date(effort.startDate).toLocaleDateString("ko-KR")}</span>
                          {isBest && (
                            <span className="text-xs font-bold bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded">BEST</span>
                          )}
                          {effort.prRank != null && effort.prRank <= 3 && (
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${RANK_STYLES[effort.prRank - 1]}`}>
                              PR #{effort.prRank}
                            </span>
                          )}
                        </div>
                        <Link to={`/activity/${effort.activityId}`} className="text-xs text-orange-600 hover:underline mt-0.5 inline-block">
                          활동 보기
                        </Link>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-semibold">{formatTime(effort.elapsedTime)}</div>
                        <div className="text-xs text-gray-500">
                          {effort.averageSpeed.toFixed(1)} km/h
                          {effort.averageWatts != null && ` · ${effort.averageWatts}W`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
