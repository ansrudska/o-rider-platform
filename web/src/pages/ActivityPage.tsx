import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import RouteMap from "../components/RouteMap";
import ElevationChart from "../components/ElevationChart";
import type { OverlayDataset } from "../components/ElevationChart";
import Avatar from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import {
  activities as demoActivities,
  comments,
  kudos,
  generateElevationProfile,
} from "../data/demo";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../services/firebase";
import type { Activity, GroupRide } from "@shared/types";
import type { ActivityStreams } from "@shared/types";

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "방금 전";
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CLIMB_CATEGORIES = ["", "4", "3", "2", "1", "HC"];

interface SegmentEffortData {
  id: number;
  name: string;
  elapsedTime: number;
  movingTime: number;
  distance: number;
  startIndex: number;
  endIndex: number;
  averageWatts: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  prRank: number | null;
  komRank: number | null;
  achievements: { type_id: number; type: string; rank: number }[];
  segment: {
    id: number;
    name: string;
    distance: number;
    averageGrade: number;
    maximumGrade: number;
    elevationHigh: number;
    elevationLow: number;
    climbCategory: number;
    starred: boolean;
  };
}

interface SampledPoint {
  latlng: [number, number] | null;
  distance: number;
  altitude: number;
  speed: number;
  heartRate: number;
  power: number;
  cadence: number;
}

export default function ActivityPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const { user, profile } = useAuth();
  const { getStreams } = useStrava();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showStreamSpinner, setShowStreamSpinner] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [groupRide, setGroupRide] = useState<GroupRide | null>(null);

  useEffect(() => {
    if (!activityId) return;

    const demoActivity = demoActivities.find((a) => a.id === activityId);
    if (demoActivity) {
      setActivity(demoActivity);
      setLoadingActivity(false);
      return;
    }

    if (user) {
      getDoc(doc(firestore, "activities", activityId)).then((snap) => {
        if (snap.exists()) {
          setActivity({ id: snap.id, ...snap.data() } as Activity);
        }
        setLoadingActivity(false);
      }).catch(() => setLoadingActivity(false));
    } else {
      setLoadingActivity(false);
    }
  }, [activityId, user]);

  useEffect(() => {
    if (!activity || !user || !profile?.stravaConnected || streams) return;

    const stravaId = (activity as Activity & { stravaActivityId?: number }).stravaActivityId;
    if (!stravaId) return;

    // Delay showing spinner to avoid flash when cached data returns quickly
    const timer = setTimeout(() => setShowStreamSpinner(true), 500);
    getStreams(stravaId).then((data) => {
      setStreams(data as unknown as ActivityStreams);
    }).catch(() => {}).finally(() => {
      clearTimeout(timer);
      setShowStreamSpinner(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, user, profile?.stravaConnected]);

  // Fetch group ride (co-riders) when activity has groupRideId
  useEffect(() => {
    if (!activity?.groupRideId) return;

    getDoc(doc(firestore, "group_rides", activity.groupRideId)).then((snap) => {
      if (snap.exists()) {
        setGroupRide({ id: snap.id, ...snap.data() } as GroupRide);
      }
    }).catch(() => {});
  }, [activity?.groupRideId]);

  const handleElevHover = useCallback((index: number | null) => {
    setHoverIndex(index);
  }, []);

  // Build sampled data from streams
  const sampledData: SampledPoint[] = useMemo(() => {
    if (!streams?.distance) return [];
    const dist = streams.distance;
    const len = dist.length;
    const interval = Math.max(1, Math.floor(len / 300));
    const points: SampledPoint[] = [];
    for (let i = 0; i < len; i += interval) {
      points.push({
        latlng: streams.latlng?.[i] as [number, number] ?? null,
        distance: dist[i] ?? 0,
        altitude: (streams.altitude as number[] | undefined)?.[i] ?? 0,
        speed: (streams.velocity_smooth?.[i] ?? 0) * 3.6,
        heartRate: streams.heartrate?.[i] ?? 0,
        power: streams.watts?.[i] ?? 0,
        cadence: streams.cadence?.[i] ?? 0,
      });
    }
    return points;
  }, [streams]);

  const markerPosition = useMemo(() => {
    if (hoverIndex == null || !sampledData[hoverIndex]) return null;
    return sampledData[hoverIndex].latlng;
  }, [hoverIndex, sampledData]);

  // Segment efforts from streams response
  const segmentEfforts: SegmentEffortData[] = useMemo(() => {
    const raw = (streams as Record<string, unknown> | null)?.segment_efforts;
    if (!Array.isArray(raw)) return [];
    return raw as SegmentEffortData[];
  }, [streams]);

  // Photos from streams response
  interface PhotoData { id: string; url: string | null; caption: string | null; location: [number, number] | null; }
  const photos: PhotoData[] = useMemo(() => {
    const raw = (streams as Record<string, unknown> | null)?.photos;
    if (!Array.isArray(raw)) return [];
    return raw as PhotoData[];
  }, [streams]);

  if (loadingActivity) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="h-80 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg">활동을 찾을 수 없습니다.</p>
        <Link to="/" className="text-orange-600 hover:underline text-sm mt-2 inline-block">홈으로 돌아가기</Link>
      </div>
    );
  }

  const s = activity.summary;
  const isDemo = demoActivities.some((a) => a.id === activity.id);
  const isStrava = (activity as Activity & { source?: string }).source === "strava";
  const hasStreams = sampledData.length > 0;

  // Elevation data: real streams or demo-generated
  const elevData = hasStreams
    ? sampledData.map((d) => ({ distance: d.distance, elevation: d.altitude }))
    : isDemo
      ? generateElevationProfile(s.distance, s.elevationGain)
      : [];

  // Performance overlays for combined chart
  const overlays: OverlayDataset[] = [];
  if (hasStreams) {
    if (sampledData.some((d) => d.speed > 0))
      overlays.push({ label: "속도 (km/h)", data: sampledData.map((d) => d.speed), color: "rgba(59, 130, 246, 0.7)", yAxisID: "ySpeed" });
    if (sampledData.some((d) => d.heartRate > 0))
      overlays.push({ label: "심박 (bpm)", data: sampledData.map((d) => d.heartRate), color: "rgba(239, 68, 68, 0.7)", yAxisID: "yHR" });
    if (sampledData.some((d) => d.power > 0))
      overlays.push({ label: "파워 (W)", data: sampledData.map((d) => d.power), color: "rgba(168, 85, 247, 0.7)", yAxisID: "yPower" });
    if (sampledData.some((d) => d.cadence > 0))
      overlays.push({ label: "케이던스 (rpm)", data: sampledData.map((d) => d.cadence), color: "rgba(16, 185, 129, 0.7)", yAxisID: "yCadence" });
  }

  const activityComments = isDemo ? (comments[activity.id] ?? []) : [];
  const activityKudos = isDemo ? (kudos[activity.id] ?? []) : [];

  // Top results: efforts with PR or KOM achievements
  const topResults = segmentEfforts.filter(
    (e) => (e.prRank != null && e.prRank >= 1 && e.prRank <= 3) || (e.komRank != null && e.komRank >= 1 && e.komRank <= 10),
  );
  const prCount = segmentEfforts.filter((e) => e.prRank != null && e.prRank <= 3).length;
  const komCount = segmentEfforts.filter((e) => e.komRank != null && e.komRank <= 10).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Map */}
      <RouteMap
        polyline={activity.thumbnailTrack}
        latlng={streams?.latlng}
        height="h-80 sm:h-96"
        interactive
        markerPosition={markerPosition}
        photos={photos
          .filter((p) => p.url && p.location)
          .map((p) => ({ id: p.id, url: p.url!, location: p.location!, caption: p.caption }))}
      />

      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start gap-4">
          <Avatar
            name={activity.nickname}
            imageUrl={activity.profileImage}
            size="lg"
            userId={activity.userId}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/athlete/${activity.userId}`}
                className="font-semibold text-gray-700 hover:text-orange-600 text-sm"
              >
                {activity.nickname}
              </Link>
              {isStrava && (
                <svg className="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
              )}
              {hasStreams && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">GPS</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{activity.description || "라이딩"}</h1>
            <div className="text-sm text-gray-500 mt-1">{formatFullDate(activity.startTime)}</div>
          </div>
        </div>
      </div>

      {/* Top Results */}
      {topResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Top Results</h3>
            {segmentEfforts.length > topResults.length && (
              <a href="#segments" className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                View all
              </a>
            )}
          </div>
          <div className="space-y-2">
            {topResults.map((effort) => {
              const rank = effort.prRank ?? effort.komRank ?? 0;
              const isKOM = effort.komRank != null && effort.komRank >= 1 && effort.komRank <= 10;
              const ordinal = rank === 1 ? "Fastest" : rank === 2 ? "2nd fastest" : rank === 3 ? "3rd fastest" : `${rank}th`;
              const label = isKOM
                ? `KOM #${effort.komRank} on ${effort.name}`
                : `${ordinal} time on ${effort.name}`;
              return (
                <div key={effort.id} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    rank === 1 ? "bg-yellow-400" : rank === 2 ? "bg-gray-300" : "bg-orange-300"
                  }`}>
                    <svg className={`w-3.5 h-3.5 ${rank === 1 ? "text-yellow-800" : rank === 2 ? "text-gray-600" : "text-orange-700"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className="text-sm font-semibold text-gray-900 ml-1">({formatTime(effort.elapsedTime)})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats grid (Strava style) */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">거리</div>
            <div className="text-xl font-bold">{(s.distance / 1000).toFixed(1)} <span className="text-sm font-normal text-gray-500">km</span></div>
          </div>
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">이동 시간</div>
            <div className="text-xl font-bold">{formatDuration(s.ridingTimeMillis)}</div>
          </div>
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">획득고도</div>
            <div className="text-xl font-bold">{Math.round(s.elevationGain)} <span className="text-sm font-normal text-gray-500">m</span></div>
          </div>
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">평균 속도</div>
            <div className="text-xl font-bold">{s.averageSpeed.toFixed(1)} <span className="text-sm font-normal text-gray-500">km/h</span></div>
          </div>
          {s.maxSpeed > 0 && (
            <div className="border-l-2 border-gray-200 pl-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">최고 속도</div>
              <div className="text-lg font-semibold">{s.maxSpeed.toFixed(1)} <span className="text-sm font-normal text-gray-500">km/h</span></div>
            </div>
          )}
          {s.averageHeartRate != null && (
            <div className="border-l-2 border-red-400 pl-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">평균 심박</div>
              <div className="text-lg font-semibold">{s.averageHeartRate} <span className="text-sm font-normal text-gray-500">bpm</span></div>
              {s.maxHeartRate != null && <div className="text-xs text-gray-400">최고 {s.maxHeartRate} bpm</div>}
            </div>
          )}
          {s.averagePower != null && (
            <div className="border-l-2 border-purple-400 pl-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">평균 파워</div>
              <div className="text-lg font-semibold">{s.averagePower} <span className="text-sm font-normal text-gray-500">W</span></div>
              {s.normalizedPower != null && <div className="text-xs text-gray-400">NP {s.normalizedPower} W</div>}
            </div>
          )}
          {s.averageCadence != null && (
            <div className="border-l-2 border-gray-200 pl-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">평균 케이던스</div>
              <div className="text-lg font-semibold">{s.averageCadence} <span className="text-sm font-normal text-gray-500">rpm</span></div>
            </div>
          )}
          {s.calories != null && (
            <div className="border-l-2 border-gray-200 pl-3">
              <div className="text-xs text-gray-500 uppercase tracking-wide">칼로리</div>
              <div className="text-lg font-semibold">{s.calories} <span className="text-sm font-normal text-gray-500">kcal</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Co-riders (함께 탄 라이더) */}
      {groupRide && Object.keys(groupRide.participants).length > 1 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            함께 탄 라이더 ({Object.keys(groupRide.participants).length}명)
          </h3>
          <div className="space-y-2">
            {Object.entries(groupRide.participants)
              .filter(([uid]) => uid !== activity.userId)
              .map(([uid, p]) => (
                <Link
                  key={uid}
                  to={`/activity/${p.activityId}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Avatar
                    name={p.nickname}
                    imageUrl={p.profileImage}
                    size="sm"
                    userId={uid}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.nickname}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span>{(p.distance / 1000).toFixed(1)} km</span>
                      <span>{p.averageSpeed.toFixed(1)} km/h</span>
                      {p.averageHeartRate != null && <span>{p.averageHeartRate} bpm</span>}
                      {p.averagePower != null && <span>{p.averagePower} W</span>}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatDuration(p.ridingTimeMillis)}
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Combined Elevation + Performance Chart */}
      {showStreamSpinner && isStrava && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">고도 & 성능 분석</h3>
          <div className="h-[280px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              GPS 데이터 로딩 중...
            </div>
          </div>
        </div>
      )}
      {elevData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            고도 {overlays.length > 0 ? "& 성능 분석" : "프로파일"}
            {hasStreams && <span className="ml-2 text-xs font-normal text-green-600">(실제 데이터)</span>}
            {hasStreams && <span className="ml-1 text-xs font-normal text-gray-400">— 차트 위 마우스 호버로 지도에서 위치 확인</span>}
          </h3>
          <ElevationChart
            data={elevData}
            height={overlays.length > 0 ? 280 : 200}
            onHoverIndex={hasStreams ? handleElevHover : undefined}
            overlays={overlays.length > 0 ? overlays : undefined}
          />
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            사진 ({photos.length})
          </h3>
          <div className={`grid gap-2 ${
            photos.length === 1 ? "grid-cols-1" :
            photos.length === 2 ? "grid-cols-2" :
            "grid-cols-2 sm:grid-cols-3"
          }`}>
            {photos.map((photo) => photo.url && (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group overflow-hidden rounded-lg bg-gray-100 aspect-square"
              >
                <img
                  src={photo.url}
                  alt={photo.caption || ""}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                {photo.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white truncate">{photo.caption}</p>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Segment Efforts (from Strava) */}
      {segmentEfforts.length > 0 && (
        <div id="segments" className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              세그먼트 ({segmentEfforts.length})
            </div>
            <div className="flex items-center gap-3 text-xs">
              {prCount > 0 && (
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                  PR {prCount}
                </span>
              )}
              {komCount > 0 && (
                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
                  KOM/QOM {komCount}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {segmentEfforts.map((effort) => {
              const seg = effort.segment;
              const elevGain = Math.max(0, seg.elevationHigh - seg.elevationLow);
              const cat = CLIMB_CATEGORIES[seg.climbCategory] || "";
              const isPR = effort.prRank != null && effort.prRank >= 1 && effort.prRank <= 3;
              const isKOM = effort.komRank != null && effort.komRank >= 1 && effort.komRank <= 10;
              const avgSpeed = effort.distance > 0 && effort.elapsedTime > 0
                ? (effort.distance / (effort.elapsedTime / 1000)) * 3.6
                : 0;

              return (
                <div key={effort.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {cat && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            cat === "HC" ? "bg-red-600 text-white" :
                            cat === "1" ? "bg-red-500 text-white" :
                            cat === "2" ? "bg-orange-500 text-white" :
                            cat === "3" ? "bg-yellow-500 text-white" :
                            "bg-gray-300 text-gray-700"
                          }`}>
                            {cat === "HC" ? "HC" : `Cat ${cat}`}
                          </span>
                        )}
                        <Link to={`/segment/strava_${effort.segment.id}`} className="font-medium text-sm truncate hover:text-orange-600">{effort.name}</Link>
                        {seg.starred && (
                          <svg className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span>{(seg.distance / 1000).toFixed(1)} km</span>
                        <span>{seg.averageGrade.toFixed(1)}% avg</span>
                        {elevGain > 0 && <span>{Math.round(elevGain)}m</span>}
                        {effort.averageWatts != null && <span>{effort.averageWatts}W</span>}
                        {effort.averageHeartrate != null && <span>{Math.round(effort.averageHeartrate)} bpm</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <div className="flex items-center gap-2 justify-end">
                        {isPR && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            effort.prRank === 1 ? "bg-yellow-400 text-yellow-900" :
                            effort.prRank === 2 ? "bg-gray-300 text-gray-700" :
                            "bg-orange-300 text-orange-800"
                          }`}>
                            {effort.prRank === 1 ? "PR" : `${effort.prRank}nd best`}
                          </span>
                        )}
                        {isKOM && (
                          <span className="text-xs font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded">
                            KOM #{effort.komRank}
                          </span>
                        )}
                        <span className="font-mono font-semibold text-sm">{formatTime(effort.elapsedTime)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{avgSpeed.toFixed(1)} km/h</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kudos + Comments */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
          <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-500 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            좋아요 {(activity.kudosCount || activityKudos.length) > 0 ? `${activity.kudosCount || activityKudos.length}` : ""}
          </button>
          <span className="text-sm text-gray-500">
            댓글 {(activity.commentCount || activityComments.length) > 0 ? `${activity.commentCount || activityComments.length}` : "0"}
          </span>
        </div>

        {activityKudos.length > 0 && (
          <div className="py-3 border-b border-gray-100">
            <div className="flex -space-x-1">
              {activityKudos.map((k) => (
                <Avatar key={k.userId} name={k.nickname} size="sm" userId={k.userId} />
              ))}
            </div>
          </div>
        )}

        {activityComments.length > 0 && (
          <div className="pt-3 space-y-3">
            {activityComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={c.nickname} size="sm" userId={c.userId} />
                <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/athlete/${c.userId}`} className="text-xs font-semibold hover:text-orange-600">{c.nickname}</Link>
                    <span className="text-xs text-gray-400">{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
