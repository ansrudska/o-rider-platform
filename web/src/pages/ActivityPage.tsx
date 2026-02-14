import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import RouteMap from "../components/RouteMap";
import ElevationChart from "../components/ElevationChart";
import type { OverlayDataset } from "../components/ElevationChart";
import Avatar from "../components/Avatar";
// Removed TabNav — single scroll view
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useStrava } from "../hooks/useStrava";
import {
  doc, getDoc, setDoc, deleteDoc, addDoc, updateDoc,
  collection, query, where, getDocs, orderBy, onSnapshot,
} from "firebase/firestore";
import { firestore } from "../services/firebase";
import type { Activity, Visibility } from "@shared/types";
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

interface OverlayConfig {
  key: string;
  label: string;
  unit: string;
  color: string;
  dotColor: string;
  yAxisID: string;
  getValue: (d: SampledPoint) => number;
}

const OVERLAY_CONFIGS: OverlayConfig[] = [
  { key: "speed", label: "속도", unit: "km/h", color: "rgba(59, 130, 246, 0.7)", dotColor: "#3b82f6", yAxisID: "ySpeed", getValue: (d) => d.speed },
  { key: "hr", label: "심박", unit: "bpm", color: "rgba(239, 68, 68, 0.7)", dotColor: "#ef4444", yAxisID: "yHR", getValue: (d) => d.heartRate },
  { key: "power", label: "파워", unit: "W", color: "rgba(168, 85, 247, 0.7)", dotColor: "#a855f7", yAxisID: "yPower", getValue: (d) => d.power },
  { key: "cadence", label: "케이던스", unit: "rpm", color: "rgba(6, 182, 212, 0.7)", dotColor: "#06b6d4", yAxisID: "yCadence", getValue: (d) => d.cadence },
];

export default function ActivityPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { getStreams } = useStrava();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showStreamSpinner, setShowStreamSpinner] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [coRiders, setCoRiders] = useState<Activity[]>([]);
  const [liked, setLiked] = useState(false);
  const [kudosList, setKudosList] = useState<{ userId: string; nickname: string; profileImage?: string | null }[]>([]);
  const [commentsList, setCommentsList] = useState<{ id: string; userId: string; nickname: string; profileImage: string | null; text: string; createdAt: number }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllSegments, setShowAllSegments] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  const [streamsError, setStreamsError] = useState<string | null>(null);
  const [loadingStreams, setLoadingStreams] = useState(false);
  // Single scroll view — no tabs

  useEffect(() => {
    if (!activityId) return;

    getDoc(doc(firestore, "activities", activityId)).then((snap) => {
      if (snap.exists()) {
        setActivity({ id: snap.id, ...snap.data() } as Activity);
      }
      setLoadingActivity(false);
    }).catch(() => setLoadingActivity(false));
  }, [activityId]);

  useEffect(() => {
    if (!activity || streams) return;

    const stravaId = (activity as Activity & { stravaActivityId?: number }).stravaActivityId;
    if (!stravaId) return;

    setLoadingStreams(true);
    setStreamsError(null);
    // Delay showing spinner to avoid flash when cached data returns quickly
    const timer = setTimeout(() => setShowStreamSpinner(true), 500);
    getStreams(stravaId).then((data) => {
      setStreams(data as unknown as ActivityStreams);
    }).catch((err) => {
      console.error("Streams load failed:", err);
      setStreamsError(err instanceof Error ? err.message : "GPS 데이터를 불러올 수 없습니다");
    }).finally(() => {
      clearTimeout(timer);
      setShowStreamSpinner(false);
      setLoadingStreams(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  // Fetch co-riders: activities with the same groupRideId
  useEffect(() => {
    if (!activity?.groupRideId) return;

    const q = query(
      collection(firestore, "activities"),
      where("groupRideId", "==", activity.groupRideId),
    );
    getDocs(q).then((snap) => {
      setCoRiders(
        snap.docs
          .filter((d) => d.id !== activity.id)
          .map((d) => ({ id: d.id, ...d.data() }) as Activity),
      );
    }).catch(() => {});
  }, [activity?.groupRideId, activity?.id]);

  // Real-time kudos subscription
  useEffect(() => {
    if (!activityId || !user) return;
    const kudosRef = collection(firestore, "activities", activityId, "kudos");
    return onSnapshot(kudosRef, (snap) => {
      const list = snap.docs.map((d) => ({ userId: d.id, ...d.data() } as { userId: string; nickname: string; profileImage?: string | null }));
      setKudosList(list);
      setLiked(list.some((k) => k.userId === user.uid));
    });
  }, [activityId, user]);

  // Real-time comments subscription
  useEffect(() => {
    if (!activityId || !user) return;
    const commentsRef = query(
      collection(firestore, "activities", activityId, "comments"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(commentsRef, (snap) => {
      setCommentsList(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as typeof commentsList[0])),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, user]);

  const handleToggleKudos = async () => {
    if (!user || !activityId || !profile) return;
    const kudosDocRef = doc(firestore, "activities", activityId, "kudos", user.uid);
    if (liked) {
      setLiked(false);
      await deleteDoc(kudosDocRef);
    } else {
      setLiked(true);
      await setDoc(kudosDocRef, {
        nickname: profile.nickname ?? user.displayName ?? "User",
        profileImage: user.photoURL ?? null,
        createdAt: Date.now(),
      });
      showToast("좋아요를 보냈습니다");
    }
  };

  const submittingRef = useRef(false);
  const handleSubmitComment = async () => {
    if (!user || !activityId || !profile || !commentText.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "activities", activityId, "comments"), {
        userId: user.uid,
        nickname: profile.nickname ?? user.displayName ?? "User",
        profileImage: user.photoURL ?? null,
        text: commentText.trim(),
        createdAt: Date.now(),
      });
      setCommentText("");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activityId) return;
    await deleteDoc(doc(firestore, "activities", activityId, "comments", commentId));
  };

  const handleSaveEditComment = async () => {
    if (!activityId || !editingCommentId || !editingText.trim()) return;
    await updateDoc(doc(firestore, "activities", activityId, "comments", editingCommentId), {
      text: editingText.trim(),
    });
    setEditingCommentId(null);
    setEditingText("");
  };

  const handleDeleteActivity = async () => {
    if (!activityId || !user || user.uid !== activity?.userId) return;
    if (!window.confirm("이 활동을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    await deleteDoc(doc(firestore, "activities", activityId));
    navigate("/", { replace: true });
  };

  const handleElevHover = useCallback((index: number | null) => {
    setHoverIndex(index);
  }, []);

  const toggleOverlay = useCallback((key: string) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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

  const availableOverlays = useMemo(() => {
    if (sampledData.length === 0) return [] as OverlayConfig[];
    return OVERLAY_CONFIGS.filter((cfg) => sampledData.some((d) => cfg.getValue(d) > 0));
  }, [sampledData]);

  const summaryStats = useMemo(() => {
    if (sampledData.length === 0) return null;
    const minElev = Math.min(...sampledData.map((d) => d.altitude));
    const maxElev = Math.max(...sampledData.map((d) => d.altitude));
    const stats: Record<string, { avg: number; max: number }> = {};
    for (const cfg of OVERLAY_CONFIGS) {
      const values = sampledData.map((d) => cfg.getValue(d)).filter((v) => v > 0);
      if (values.length > 0) {
        stats[cfg.key] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          max: Math.max(...values),
        };
      }
    }
    return { minElev, maxElev, overlays: stats };
  }, [sampledData]);

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
        <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg">활동을 찾을 수 없습니다.</p>
        <Link to="/" className="text-orange-600 hover:underline text-sm mt-2 inline-block">홈으로 돌아가기</Link>
      </div>
    );
  }

  const s = activity.summary;
  const isStrava = (activity as Activity & { source?: string }).source === "strava";
  const activityProfileImage = activity.profileImage || (user?.uid === activity.userId ? user?.photoURL ?? null : null);
  const hasStreams = sampledData.length > 0;

  // Elevation data from streams
  const elevData = hasStreams
    ? sampledData.map((d) => ({ distance: d.distance, elevation: d.altitude }))
    : [];

  // Build chart overlays from active toggles
  const chartOverlays: OverlayDataset[] = availableOverlays
    .filter((cfg) => activeOverlays.has(cfg.key))
    .map((cfg) => ({
      label: `${cfg.label} (${cfg.unit})`,
      data: sampledData.map((d) => cfg.getValue(d)),
      color: cfg.color,
      yAxisID: cfg.yAxisID,
      unit: cfg.unit,
    }));

  const hoverPoint = hoverIndex != null ? sampledData[hoverIndex] ?? null : null;

  const activityComments = commentsList;
  const activityKudos = kudosList;

  // Top results: efforts with PR or KOM achievements
  const topResults = segmentEfforts.filter(
    (e) => (e.prRank != null && e.prRank >= 1 && e.prRank <= 3) || (e.komRank != null && e.komRank >= 1 && e.komRank <= 10),
  );
  const prCount = segmentEfforts.filter((e) => e.prRank != null && e.prRank <= 3).length;
  const komCount = segmentEfforts.filter((e) => e.komRank != null && e.komRank <= 10).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. Header (제목) */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-start gap-4">
          <Avatar
            name={activity.nickname}
            imageUrl={activityProfileImage}
            size="lg"
            userId={activity.userId}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/athlete/${activity.userId}`}
                className="font-semibold text-gray-700 dark:text-gray-200 hover:text-orange-600 text-sm"
              >
                {activity.nickname}
              </Link>
              {isStrava ? (
                <svg className="w-4 h-4 text-[#FC4C02]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
              ) : (
                <img src="/favicon.svg" alt="O-Rider" className="w-4 h-4" />
              )}
              {hasStreams && (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded font-medium">GPS</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{activity.description || "라이딩"}</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatFullDate(activity.startTime)}</div>
            {user?.uid === activity.userId && (
              <div className="flex items-center gap-1.5 mt-2">
                {([
                  { value: "everyone", label: "전체 공개", icon: "🌐" },
                  { value: "friends", label: "친구", icon: "👥" },
                  { value: "private", label: "비공개", icon: "🔒" },
                ] as { value: Visibility; label: string; icon: string }[]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      updateDoc(doc(firestore, "activities", activity.id), { visibility: opt.value });
                      setActivity({ ...activity, visibility: opt.value });
                    }}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      activity.visibility === opt.value
                        ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 text-orange-700"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
                <button
                  onClick={handleDeleteActivity}
                  className="ml-auto px-2 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 지도 (full width) ── */}
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

      {/* ── Two-column layout: Main | Sidebar ── */}
      <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Left: 분석 / 스탯 / 사진 / 댓글 ── */}
      <div className="flex-1 min-w-0 space-y-6">

      {/* 분석 (고도 & 성능 차트) */}
      {(showStreamSpinner || loadingStreams) && isStrava && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">고도 & 성능 분석</h3>
          <div className="h-[320px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500">
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            고도 {availableOverlays.length > 0 ? "& 성능 분석" : "프로파일"}
          </h3>

          {/* Overlay toggle buttons */}
          {hasStreams && availableOverlays.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 cursor-default">
                <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                고도
              </span>
              {availableOverlays.map((cfg) => (
                <button
                  key={cfg.key}
                  onClick={() => toggleOverlay(cfg.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                    activeOverlays.has(cfg.key)
                      ? ""
                      : "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  style={activeOverlays.has(cfg.key) ? {
                    color: cfg.dotColor,
                    borderColor: cfg.dotColor,
                    backgroundColor: `${cfg.dotColor}15`,
                  } : undefined}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: activeOverlays.has(cfg.key) ? cfg.dotColor : "#9ca3af" }}
                  />
                  {cfg.label}
                </button>
              ))}
            </div>
          )}

          {/* Hover data panel */}
          {hasStreams && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-2 min-h-[20px] text-gray-600 dark:text-gray-300">
              {hoverPoint ? (
                <>
                  <span className="font-medium text-gray-800 dark:text-gray-100">{(hoverPoint.distance / 1000).toFixed(1)} km</span>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span style={{ color: "#16a34a" }}>고도 {Math.round(hoverPoint.altitude)}m</span>
                  {availableOverlays.flatMap((cfg) => {
                    if (!activeOverlays.has(cfg.key)) return [];
                    const val = cfg.getValue(hoverPoint);
                    if (val <= 0) return [];
                    return [
                      <span key={`${cfg.key}-sep`} className="text-gray-300 dark:text-gray-600">|</span>,
                      <span key={cfg.key} style={{ color: cfg.dotColor }}>
                        {cfg.label} {cfg.key === "speed" ? val.toFixed(1) : Math.round(val)} {cfg.unit}
                      </span>,
                    ];
                  })}
                </>
              ) : summaryStats ? (
                <>
                  <span style={{ color: "#16a34a" }}>고도 {Math.round(summaryStats.minElev)} ~ {Math.round(summaryStats.maxElev)}m</span>
                  {availableOverlays.flatMap((cfg) => {
                    const stat = summaryStats.overlays[cfg.key];
                    if (!stat || !activeOverlays.has(cfg.key)) return [];
                    return [
                      <span key={`${cfg.key}-sep`} className="text-gray-300 dark:text-gray-600">|</span>,
                      <span key={cfg.key} style={{ color: cfg.dotColor }}>
                        평균 {cfg.key === "speed" ? stat.avg.toFixed(1) : Math.round(stat.avg)} {cfg.unit}
                      </span>,
                    ];
                  })}
                </>
              ) : null}
            </div>
          )}

          <ElevationChart
            data={elevData}
            height={chartOverlays.length > 0 ? 320 : 200}
            onHoverIndex={hasStreams ? handleElevHover : undefined}
            overlays={chartOverlays.length > 0 ? chartOverlays : undefined}
          />
        </div>
      )}

      {/* Streams error */}
      {isStrava && !hasStreams && !loadingStreams && !showStreamSpinner && streamsError && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>{streamsError}</p>
            <button
              onClick={() => {
                const stravaId = (activity as Activity & { stravaActivityId?: number }).stravaActivityId;
                if (!stravaId) return;
                setLoadingStreams(true);
                setStreamsError(null);
                setShowStreamSpinner(true);
                getStreams(stravaId).then((data) => {
                  setStreams(data as unknown as ActivityStreams);
                }).catch((err) => {
                  setStreamsError(err instanceof Error ? err.message : "GPS 데이터를 불러올 수 없습니다");
                }).finally(() => {
                  setShowStreamSpinner(false);
                  setLoadingStreams(false);
                });
              }}
              className="mt-2 text-orange-600 hover:text-orange-700 font-medium"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 스탯 */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6">
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">거리</div>
            <div className="text-xl font-bold">{(s.distance / 1000).toFixed(1)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">km</span></div>
          </div>
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">이동 시간</div>
            <div className="text-xl font-bold">{formatDuration(s.ridingTimeMillis)}</div>
          </div>
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">획득고도</div>
            <div className="text-xl font-bold">{Math.round(s.elevationGain)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">m</span></div>
          </div>
          <div className="border-l-2 border-orange-400 pl-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">평균 속도</div>
            <div className="text-xl font-bold">{s.averageSpeed.toFixed(1)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">km/h</span></div>
          </div>
          {s.maxSpeed > 0 && (
            <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">최고 속도</div>
              <div className="text-lg font-semibold">{s.maxSpeed.toFixed(1)} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">km/h</span></div>
            </div>
          )}
          {s.averageHeartRate != null && (
            <div className="border-l-2 border-red-400 pl-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">평균 심박</div>
              <div className="text-lg font-semibold">{s.averageHeartRate} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">bpm</span></div>
              {s.maxHeartRate != null && <div className="text-xs text-gray-400 dark:text-gray-500">최고 {s.maxHeartRate} bpm</div>}
            </div>
          )}
          {s.averagePower != null && (
            <div className="border-l-2 border-purple-400 pl-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">평균 파워</div>
              <div className="text-lg font-semibold">{s.averagePower} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">W</span></div>
              {s.normalizedPower != null && <div className="text-xs text-gray-400 dark:text-gray-500">NP {s.normalizedPower} W</div>}
            </div>
          )}
          {s.averageCadence != null && (
            <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">평균 케이던스</div>
              <div className="text-lg font-semibold">{s.averageCadence} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">rpm</span></div>
            </div>
          )}
          {s.calories != null && (
            <div className="border-l-2 border-gray-200 dark:border-gray-700 pl-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">칼로리</div>
              <div className="text-lg font-semibold">{s.calories} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">kcal</span></div>
            </div>
          )}
        </div>
      </div>

      {/* 사진 (가로 스크롤) */}
      {photos.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            사진 ({photos.length})
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
            {photos.map((photo) => photo.url && (
              <a
                key={photo.id}
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group flex-shrink-0 w-48 h-48 sm:w-56 sm:h-56 snap-start overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
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

      {/* Co-riders (함께 탄 라이더) */}
      {coRiders.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="7" r="3.5" fill="#F97316" opacity="0.15" stroke="#F97316" strokeWidth="1.2" />
              <path d="M2 19.5v-1a5 5 0 0110 0v1" stroke="#F97316" strokeWidth="1.3" strokeLinecap="round" />
              <circle cx="16" cy="8" r="2.5" fill="#F97316" opacity="0.1" stroke="#F97316" strokeWidth="1.2" />
              <path d="M14 19.5v-.5a4 4 0 018 0v.5" stroke="#F97316" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            함께 탄 라이더 ({coRiders.length}명)
          </h3>
          <div className="space-y-2">
            {coRiders.map((r) => (
              <Link
                key={r.id}
                to={`/activity/${r.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Avatar
                  name={r.nickname}
                  imageUrl={r.profileImage}
                  size="sm"
                  userId={r.userId}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{r.nickname}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>{(r.summary.distance / 1000).toFixed(1)} km</span>
                    <span>{r.summary.averageSpeed.toFixed(1)} km/h</span>
                    {r.summary.averageHeartRate != null && <span>{r.summary.averageHeartRate} bpm</span>}
                    {r.summary.averagePower != null && <span>{r.summary.averagePower} W</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDuration(r.summary.ridingTimeMillis)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. 좋아요 & 댓글 ── */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-center gap-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={handleToggleKudos}
            disabled={!user}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              liked ? "text-orange-500" : "text-gray-500 dark:text-gray-400 hover:text-orange-500"
            } disabled:opacity-50`}
          >
            <svg className="w-5 h-5" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            좋아요{activityKudos.length > 0 ? ` ${activityKudos.length}` : ""}
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            댓글 {activityComments.length > 0 ? activityComments.length : "0"}
          </span>
        </div>

        {activityKudos.length > 0 && (
          <div className="py-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex -space-x-1">
              {activityKudos.map((k) => (
                <Avatar key={k.userId} name={k.nickname} imageUrl={k.profileImage} size="sm" userId={k.userId} />
              ))}
            </div>
          </div>
        )}

        {activityComments.length > 0 && (
          <div className="pt-3 space-y-3">
            {activityComments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={c.nickname} imageUrl={c.profileImage} size="sm" userId={c.userId} />
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Link to={`/athlete/${c.userId}`} className="text-xs font-semibold hover:text-orange-600">{c.nickname}</Link>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(c.createdAt)}</span>
                    {user?.uid === c.userId && editingCommentId !== c.id && (
                      <span className="ml-auto flex gap-1">
                        <button
                          onClick={() => { setEditingCommentId(c.id); setEditingText(c.text); }}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-orange-500"
                        >수정</button>
                        <button
                          onClick={() => { if (window.confirm("댓글을 삭제하시겠습니까?")) handleDeleteComment(c.id); }}
                          className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500"
                        >삭제</button>
                      </span>
                    )}
                  </div>
                  {editingCommentId === c.id ? (
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleSaveEditComment(); } if (e.key === "Escape") { setEditingCommentId(null); } }}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:border-orange-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
                      />
                      <button onClick={handleSaveEditComment} disabled={!editingText.trim()} className="text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50">저장</button>
                      <button onClick={() => setEditingCommentId(null)} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">취소</button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-200 mt-0.5">{c.text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment input */}
        {user && (
          <div className="pt-3 flex items-start gap-2">
            <Avatar
              name={profile?.nickname ?? user.displayName ?? "User"}
              imageUrl={user.photoURL}
              size="sm"
            />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSubmitComment(); } }}
                placeholder="댓글을 입력하세요..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-orange-300 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50"
              />
              <button
                onClick={handleSubmitComment}
                disabled={submitting || !commentText.trim()}
                className="px-3 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                등록
              </button>
            </div>
          </div>
        )}
      </div>

      </div>{/* end left column */}

      {/* ── Right sidebar: 주요성과 / 세그먼트 ── */}
      {(topResults.length > 0 || segmentEfforts.length > 0) && (
      <div className="lg:w-80 flex-shrink-0 space-y-6 lg:border-l lg:border-gray-200 lg:dark:border-gray-700 lg:pl-6">

      {/* 주요 성과 */}
      {topResults.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M7 4h10v7a5 5 0 01-10 0V4z" fill="#FBBF24" />
                <path d="M7 4h10v7a5 5 0 01-10 0V4z" fill="url(#trophy-shine)" />
                <path d="M7 6.5H5.5a2 2 0 00-2 2v0c0 1.66 1.34 3 3 3H7" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M17 6.5h1.5a2 2 0 012 2v0c0 1.66-1.34 3-3 3H17" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" />
                <rect x="10" y="15" width="4" height="2.5" rx="0.5" fill="#F59E0B" />
                <rect x="8" y="18" width="8" height="2" rx="1" fill="#D97706" />
                <path d="M9.5 7v4" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.45" />
                <defs>
                  <linearGradient id="trophy-shine" x1="7" y1="4" x2="17" y2="11">
                    <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-50">주요 성과</h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">{topResults.length}</span>
            </div>
            {topResults.length > 3 && (
              <button
                onClick={() => setShowAllResults(!showAllResults)}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                {showAllResults ? "접기" : `전체 ${topResults.length}개`}
              </button>
            )}
          </div>
          <div className="space-y-1">
            {(showAllResults ? topResults : topResults.slice(0, 3)).map((effort) => {
              const isPR = effort.prRank != null && effort.prRank >= 1 && effort.prRank <= 3;
              const isKOM = effort.komRank != null && effort.komRank >= 1 && effort.komRank <= 10;
              const rank = isPR ? effort.prRank! : (effort.komRank ?? 0);

              let iconBg: string;
              let iconContent: React.ReactNode;
              let badgeText: string;
              let badgeBg: string;

              if (isKOM) {
                iconBg = "bg-gradient-to-br from-orange-400 to-orange-600";
                iconContent = (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                    <path d="M4 17h16l-2-10-4.5 4L12 5l-1.5 6L6 7l-2 10z" fill="white" />
                    <path d="M4 17h16l-2-10-4.5 4L12 5l-1.5 6L6 7l-2 10z" fill="white" opacity="0.15" />
                    <circle cx="6" cy="7" r="1.5" fill="white" opacity="0.7" />
                    <circle cx="12" cy="4.5" r="1.5" fill="white" opacity="0.7" />
                    <circle cx="18" cy="7" r="1.5" fill="white" opacity="0.7" />
                    <rect x="4" y="18" width="16" height="2.5" rx="0.75" fill="white" opacity="0.85" />
                  </svg>
                );
                badgeText = `KOM #${effort.komRank}`;
                badgeBg = "bg-gradient-to-r from-orange-500 to-orange-600 text-white";
              } else if (rank === 1) {
                iconBg = "bg-gradient-to-br from-yellow-300 to-amber-500";
                iconContent = (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                    <path d="M8 4h8v6.5a4 4 0 01-8 0V4z" fill="#92400E" opacity="0.25" />
                    <path d="M8 4h8v6.5a4 4 0 01-8 0V4z" fill="white" opacity="0.7" />
                    <path d="M8 6H6.5a1.5 1.5 0 00-1.5 1.5v0A2.5 2.5 0 007.5 10H8" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
                    <path d="M16 6h1.5A1.5 1.5 0 0119 7.5v0a2.5 2.5 0 01-2.5 2.5H16" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
                    <rect x="10.5" y="13" width="3" height="3" rx="0.5" fill="white" opacity="0.7" />
                    <rect x="9" y="17" width="6" height="2" rx="1" fill="white" opacity="0.85" />
                    <path d="M10.5 6.5v3" stroke="white" strokeWidth="0.75" strokeLinecap="round" opacity="0.5" />
                  </svg>
                );
                badgeText = "PR";
                badgeBg = "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900";
              } else if (rank === 2) {
                iconBg = "bg-gradient-to-br from-slate-300 to-slate-500";
                iconContent = (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                    <path d="M10 3l-1 5h6l-1-5h-4z" fill="white" opacity="0.5" />
                    <circle cx="12" cy="14" r="6" fill="white" opacity="0.25" />
                    <circle cx="12" cy="14" r="6" stroke="white" strokeWidth="1.5" opacity="0.8" />
                    <circle cx="12" cy="14" r="3.5" stroke="white" strokeWidth="1" opacity="0.5" />
                    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" opacity="0.85">2</text>
                  </svg>
                );
                badgeText = "2nd";
                badgeBg = "bg-gradient-to-r from-slate-400 to-slate-500 text-white";
              } else {
                iconBg = "bg-gradient-to-br from-orange-300 to-orange-500";
                iconContent = (
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none">
                    <path d="M10 3l-1 5h6l-1-5h-4z" fill="white" opacity="0.5" />
                    <circle cx="12" cy="14" r="6" fill="white" opacity="0.25" />
                    <circle cx="12" cy="14" r="6" stroke="white" strokeWidth="1.5" opacity="0.8" />
                    <circle cx="12" cy="14" r="3.5" stroke="white" strokeWidth="1" opacity="0.5" />
                    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" opacity="0.85">3</text>
                  </svg>
                );
                badgeText = "3rd";
                badgeBg = "bg-gradient-to-r from-orange-400 to-orange-500 text-white";
              }

              return (
                <div key={effort.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    {iconContent}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/segment/strava_${effort.segment.id}`}
                      className="text-sm font-medium text-gray-900 dark:text-gray-50 hover:text-orange-600 transition-colors truncate block"
                    >
                      {effort.name}
                    </Link>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {(effort.segment.distance / 1000).toFixed(1)} km
                      {effort.segment.averageGrade > 0 && ` · ${effort.segment.averageGrade.toFixed(1)}%`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm ${badgeBg}`}>
                      {badgeText}
                    </span>
                    <div className="font-mono font-bold text-xs text-gray-900 dark:text-gray-50 tabular-nums mt-0.5">{formatTime(effort.elapsedTime)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 세그먼트 */}
      {segmentEfforts.length > 0 && (
        <div id="segments" className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M2 20L8.5 8l4 6 3.5-5L22 20H2z" fill="#F97316" opacity="0.15" />
                <path d="M2 20L8.5 8l4 6 3.5-5L22 20" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8.5 8l4 6" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              세그먼트 ({segmentEfforts.length})
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {prCount > 0 && (
                <span className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full font-bold text-[11px]">
                  PR {prCount}
                </span>
              )}
              {komCount > 0 && (
                <span className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 px-2 py-0.5 rounded-full font-bold text-[11px]">
                  KOM {komCount}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {(showAllSegments ? segmentEfforts : segmentEfforts.slice(0, 5)).map((effort) => {
              const seg = effort.segment;
              const cat = CLIMB_CATEGORIES[seg.climbCategory] || "";
              const isPR = effort.prRank != null && effort.prRank >= 1 && effort.prRank <= 3;
              const isKOM = effort.komRank != null && effort.komRank >= 1 && effort.komRank <= 10;

              return (
                <div key={effort.id} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-2">
                    {cat && (
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded leading-none ${
                        cat === "HC" ? "bg-red-600 text-white" :
                        cat === "1" ? "bg-red-500 text-white" :
                        cat === "2" ? "bg-orange-500 text-white" :
                        cat === "3" ? "bg-yellow-500 text-white" :
                        "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                      }`}>
                        {cat === "HC" ? "HC" : `C${cat}`}
                      </span>
                    )}
                    <Link to={`/segment/strava_${effort.segment.id}`} className="font-medium text-sm truncate hover:text-orange-600 flex-1 min-w-0">{effort.name}</Link>
                    {isPR && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        effort.prRank === 1 ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900" :
                        effort.prRank === 2 ? "bg-gradient-to-r from-slate-300 to-slate-400 text-white" :
                        "bg-gradient-to-r from-orange-300 to-orange-400 text-white"
                      }`}>
                        {effort.prRank === 1 ? "PR" : `${effort.prRank}nd`}
                      </span>
                    )}
                    {isKOM && (
                      <span className="text-[10px] font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white px-1.5 py-0.5 rounded-full">
                        KOM
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{(seg.distance / 1000).toFixed(1)}km · {seg.averageGrade.toFixed(1)}%</span>
                    <span className="font-mono font-semibold text-gray-900 dark:text-gray-50">{formatTime(effort.elapsedTime)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {segmentEfforts.length > 5 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
              <button
                onClick={() => setShowAllSegments(!showAllSegments)}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                {showAllSegments ? "접기" : `+${segmentEfforts.length - 5}개 더`}
              </button>
            </div>
          )}
        </div>
      )}

      </div>
      )}

      </div>{/* end two-column flex */}
    </div>
  );
}

