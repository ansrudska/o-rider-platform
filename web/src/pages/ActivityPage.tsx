import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import StatCard from "../components/StatCard";
import MapPlaceholder from "../components/MapPlaceholder";
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
);

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

export default function ActivityPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const { user, profile } = useAuth();
  const { getStreams } = useStrava();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // Load activity: from Firestore if logged in, otherwise demo
  useEffect(() => {
    if (!activityId) return;

    const demoActivity = demoActivities.find((a) => a.id === activityId);
    if (demoActivity) {
      setActivity(demoActivity);
      setLoadingActivity(false);
      return;
    }

    // Try Firestore
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

  // Load Strava streams if applicable
  useEffect(() => {
    if (!activity || !user || !profile?.stravaConnected) return;

    const stravaId = (activity as Activity & { stravaActivityId?: number }).stravaActivityId;
    if (!stravaId) return;

    getStreams(stravaId).then((data) => {
      setStreams(data as unknown as ActivityStreams);
    }).catch(() => {
      // Streams not available, use simulated
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity, user, profile?.stravaConnected]);

  if (loadingActivity) {
    return (
      <div className="space-y-6">
        <div className="h-72 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12 text-gray-500">
        활동을 찾을 수 없습니다.
      </div>
    );
  }

  const s = activity.summary;
  const isDemo = demoActivities.some((a) => a.id === activity.id);

  // Build chart data from streams or simulation
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

  const perfChartData = {
    labels: perfProfile.map((d) => `${(d.distance / 1000).toFixed(1)}`),
    datasets: [
      {
        label: "속도 (km/h)",
        data: perfProfile.map((d) => d.speed),
        borderColor: "rgba(59, 130, 246, 0.8)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: "y",
      },
      {
        label: "심박 (bpm)",
        data: perfProfile.map((d) => d.heartRate),
        borderColor: "rgba(239, 68, 68, 0.8)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: "y1",
      },
      {
        label: "파워 (W)",
        data: perfProfile.map((d) => d.power),
        borderColor: "rgba(168, 85, 247, 0.8)",
        backgroundColor: "rgba(168, 85, 247, 0.1)",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        yAxisID: "y2",
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Source badge */}
      {!isDemo && (activity as Activity & { source?: string }).source === "strava" && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Strava에서 가져온 활동
          {streams && <span className="text-green-600">(실제 GPS 데이터)</span>}
        </div>
      )}

      {/* Map */}
      <MapPlaceholder height="h-72 sm:h-96" label="경로 지도" />

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar
          name={activity.nickname}
          imageUrl={activity.profileImage}
          size="lg"
          userId={activity.userId}
        />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{activity.description || "라이딩"}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
            <Link
              to={`/athlete/${activity.userId}`}
              className="font-medium text-gray-700 hover:text-orange-600"
            >
              {activity.nickname}
            </Link>
            <span>&middot;</span>
            <span>{timeAgo(activity.createdAt)}</span>
            <span>&middot;</span>
            <span>
              {new Date(activity.startTime).toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="거리"
          value={`${(s.distance / 1000).toFixed(1)} km`}
          icon="📏"
        />
        <StatCard
          label="시간"
          value={formatDuration(s.ridingTimeMillis)}
          icon="⏱"
        />
        <StatCard
          label="평균 속도"
          value={`${s.averageSpeed.toFixed(1)} km/h`}
          icon="🚴"
          subValue={`최고 ${s.maxSpeed.toFixed(1)} km/h`}
        />
        <StatCard
          label="획득고도"
          value={`${s.elevationGain} m`}
          icon="⛰"
        />
        {s.averageHeartRate && (
          <StatCard
            label="평균 심박"
            value={`${s.averageHeartRate} bpm`}
            icon="❤️"
            color="text-red-500"
            subValue={`최고 ${s.maxHeartRate} bpm`}
          />
        )}
        {s.averagePower && (
          <StatCard
            label="평균 파워"
            value={`${s.averagePower} W`}
            icon="⚡"
            color="text-blue-500"
            subValue={`NP ${s.normalizedPower} W`}
          />
        )}
        {s.averageCadence && (
          <StatCard
            label="평균 케이던스"
            value={`${s.averageCadence} rpm`}
            icon="🔄"
            subValue={`최고 ${s.maxCadence} rpm`}
          />
        )}
        {s.calories && (
          <StatCard label="칼로리" value={`${s.calories} kcal`} icon="🔥" />
        )}
      </div>

      {/* Elevation Profile */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          고도 프로파일
        </h3>
        <ElevationChart data={elevProfile} height={200} />
      </div>

      {/* Performance chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          속도 / 심박 / 파워
        </h3>
        <div style={{ height: 220 }}>
          <Line
            data={perfChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: {
                  position: "bottom",
                  labels: {
                    font: { size: 11 },
                    padding: 12,
                    usePointStyle: true,
                  },
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: {
                    font: { size: 10 },
                    color: "#9ca3af",
                    maxTicksLimit: 8,
                  },
                  title: {
                    display: true,
                    text: "거리 (km)",
                    font: { size: 10 },
                    color: "#9ca3af",
                  },
                },
                y: {
                  type: "linear",
                  position: "left",
                  grid: { color: "rgba(0,0,0,0.04)" },
                  ticks: {
                    font: { size: 10 },
                    color: "rgba(59,130,246,0.6)",
                  },
                },
                y1: {
                  type: "linear",
                  position: "right",
                  grid: { display: false },
                  ticks: {
                    font: { size: 10 },
                    color: "rgba(239,68,68,0.6)",
                  },
                },
                y2: {
                  type: "linear",
                  position: "right",
                  display: false,
                },
              },
            }}
          />
        </div>
      </div>

      {/* Segment Efforts */}
      {activityEfforts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 font-semibold text-sm">
            세그먼트 결과
          </div>
          <div className="divide-y divide-gray-100">
            {activityEfforts.map((effort) => {
              const seg = segments.find(
                (sg) =>
                  sg.kom?.userId === effort.userId ||
                  sg.qom?.userId === effort.userId ||
                  true,
              );
              return (
                <div
                  key={effort.id}
                  className="px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-sm">
                      {seg?.name ?? "세그먼트"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {effort.rank === 1 ? "🏆 KOM" : `#${effort.rank}`}
                      {effort.averagePower &&
                        ` · ${effort.averagePower}W`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">
                      {formatTime(effort.elapsedTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {effort.averageSpeed.toFixed(1)} km/h
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kudos + Comments */}
      {(activityKudos.length > 0 || activityComments.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          {/* Kudos */}
          {activityKudos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">
                  👍 {activityKudos.length}명이 좋아합니다
                </span>
              </div>
              <div className="flex -space-x-1">
                {activityKudos.map((k) => (
                  <Avatar
                    key={k.userId}
                    name={k.nickname}
                    size="sm"
                    userId={k.userId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {activityComments.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold">
                💬 댓글 {activityComments.length}개
              </div>
              {activityComments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Avatar name={c.nickname} size="sm" userId={c.userId} />
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/athlete/${c.userId}`}
                        className="text-xs font-semibold hover:text-orange-600"
                      >
                        {c.nickname}
                      </Link>
                      <span className="text-xs text-gray-400">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
