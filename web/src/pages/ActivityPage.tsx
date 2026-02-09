import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import RouteMap from "../components/RouteMap";
import ElevationChart from "../components/ElevationChart";
import Avatar from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { useStrava } from "../hooks/useStrava";
import {
  activities as demoActivities,
  comments,
  kudos,
  segmentEfforts,
  segments,
  generateElevationProfile,
  generatePerformanceProfile,
} from "../data/demo";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../services/firebase";
import type { Activity } from "@shared/types";
import type { ActivityStreams } from "@shared/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

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

export default function ActivityPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const { user, profile } = useAuth();
  const { getStreams } = useStrava();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

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
    if (!activity || !user || !profile?.stravaConnected) return;

    const stravaId = (activity as Activity & { stravaActivityId?: number }).stravaActivityId;
    if (!stravaId) return;

    getStreams(stravaId).then((data) => {
      setStreams(data as unknown as ActivityStreams);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, user, profile?.stravaConnected]);

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

  let elevProfile: { distance: number; elevation: number }[];
  let perfProfile: { distance: number; speed: number; heartRate: number; power: number }[];

  if (streams?.altitude && streams?.distance) {
    elevProfile = streams.distance.map((d, i) => ({
      distance: d,
      elevation: streams.altitude![i] ?? 0,
    }));
  } else {
    elevProfile = generateElevationProfile(s.distance, s.elevationGain);
  }

  if (streams?.velocity_smooth && streams?.distance) {
    perfProfile = streams.distance.map((d, i) => ({
      distance: d,
      speed: (streams.velocity_smooth![i] ?? 0) * 3.6,
      heartRate: streams.heartrate?.[i] ?? 0,
      power: streams.watts?.[i] ?? 0,
    }));
  } else {
    perfProfile = generatePerformanceProfile(s);
  }

  const activityComments = isDemo ? (comments[activity.id] ?? []) : [];
  const activityKudos = isDemo ? (kudos[activity.id] ?? []) : [];
  const activityEfforts = isDemo
    ? segmentEfforts.filter((e) => e.activityId === activity.id)
    : [];

  const sampleInterval = Math.max(1, Math.floor(perfProfile.length / 300));
  const sampledPerf = perfProfile.filter((_, i) => i % sampleInterval === 0);
  const sampledElev = elevProfile.filter((_, i) => i % sampleInterval === 0);

  const perfChartData = {
    labels: sampledPerf.map((d) => `${(d.distance / 1000).toFixed(1)}`),
    datasets: [
      {
        label: "속도 (km/h)",
        data: sampledPerf.map((d) => d.speed),
        borderColor: "rgba(59, 130, 246, 0.8)",
        backgroundColor: "rgba(59, 130, 246, 0.05)",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
        yAxisID: "y",
      },
      ...(sampledPerf.some((d) => d.heartRate > 0)
        ? [{
            label: "심박 (bpm)",
            data: sampledPerf.map((d) => d.heartRate),
            borderColor: "rgba(239, 68, 68, 0.8)",
            backgroundColor: "rgba(239, 68, 68, 0.05)",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: true,
            yAxisID: "y1",
          }]
        : []),
      ...(sampledPerf.some((d) => d.power > 0)
        ? [{
            label: "파워 (W)",
            data: sampledPerf.map((d) => d.power),
            borderColor: "rgba(168, 85, 247, 0.8)",
            backgroundColor: "rgba(168, 85, 247, 0.05)",
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            fill: true,
            yAxisID: "y2",
          }]
        : []),
    ],
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Map */}
      <RouteMap
        polyline={activity.thumbnailTrack}
        latlng={streams?.latlng}
        height="h-80 sm:h-96"
        interactive
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
              {streams && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">GPS</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{activity.description || "라이딩"}</h1>
            <div className="text-sm text-gray-500 mt-1">{formatFullDate(activity.startTime)}</div>
          </div>
        </div>
      </div>

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

      {/* Elevation Profile */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">고도 프로파일</h3>
        <ElevationChart data={sampledElev} height={200} />
      </div>

      {/* Performance chart */}
      {sampledPerf.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            성능 분석
            {streams && <span className="ml-2 text-xs font-normal text-green-600">(실제 데이터)</span>}
          </h3>
          <div style={{ height: 240 }}>
            <Line
              data={perfChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                  legend: {
                    position: "bottom",
                    labels: { font: { size: 11 }, padding: 16, usePointStyle: true },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 }, color: "#9ca3af", maxTicksLimit: 10 },
                    title: { display: true, text: "거리 (km)", font: { size: 10 }, color: "#9ca3af" },
                  },
                  y: { type: "linear", position: "left", grid: { color: "rgba(0,0,0,0.04)" }, ticks: { font: { size: 10 }, color: "rgba(59,130,246,0.6)" } },
                  y1: { type: "linear", position: "right", grid: { display: false }, ticks: { font: { size: 10 }, color: "rgba(239,68,68,0.6)" } },
                  y2: { type: "linear", position: "right", display: false },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Segment Efforts */}
      {activityEfforts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 font-semibold text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            세그먼트 결과 ({activityEfforts.length})
          </div>
          <div className="divide-y divide-gray-100">
            {activityEfforts.map((effort) => {
              const seg = segments.find((sg) => sg.id === effort.activityId) ?? segments[0];
              return (
                <div key={effort.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-sm">{seg?.name ?? "세그먼트"}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                      {effort.rank === 1 && <span className="text-orange-500 font-semibold">KOM</span>}
                      {effort.rank != null && effort.rank > 1 && <span>#{effort.rank}</span>}
                      {effort.averagePower != null && <span>{effort.averagePower}W</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold text-sm">{formatTime(effort.elapsedTime)}</div>
                    <div className="text-xs text-gray-500">{effort.averageSpeed.toFixed(1)} km/h</div>
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
