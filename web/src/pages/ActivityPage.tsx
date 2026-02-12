import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import RouteMap from "../components/RouteMap";
import ElevationChart from "../components/ElevationChart";
import type { OverlayDataset } from "../components/ElevationChart";
import Avatar from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
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

export default function ActivityPage() {
  const { activityId } = useParams<{ activityId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { getStreams } = useStrava();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [showStreamSpinner, setShowStreamSpinner] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [coRiders, setCoRiders] = useState<Activity[]>([]);
  const [liked, setLiked] = useState(false);
  const [kudosList, setKudosList] = useState<{ userId: string; nickname: string }[]>([]);
  const [commentsList, setCommentsList] = useState<{ id: string; userId: string; nickname: string; profileImage: string | null; text: string; createdAt: number }[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    if (!activityId) return;

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
      const list = snap.docs.map((d) => ({ userId: d.id, ...d.data() } as { userId: string; nickname: string }));
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
  const isStrava = (activity as Activity & { source?: string }).source === "strava";
  const hasStreams = sampledData.length > 0;

  // Elevation data from streams
  const elevData = hasStreams
    ? sampledData.map((d) => ({ distance: d.distance, elevation: d.altitude }))
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

  const activityComments = commentsList;
  const activityKudos = kudosList;

  // Top results: efforts with PR or KOM achievements
  const topResults = segmentEfforts.filter(
    (e) => (e.prRank != null && e.prRank >= 1 && e.prRank <= 3) || (e.komRank != null && e.komRank >= 1 && e.komRank <= 10),
  );
  const prCount = segmentEfforts.filter((e) => e.prRank != null && e.prRank <= 3).length;
  const komCount = segmentEfforts.filter((e) => e.komRank != null && e.komRank <= 10).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 1. Header (제목) */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
            {user?.uid === activity.userId && (
              <div className="flex items-center gap-1.5 mt-2">
                {([
                  { value: "everyone", label: "전체 공개", icon: "🌐" },
                  { value: "friends", label: "팔로워", icon: "👥" },
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
                        ? "bg-orange-50 border-orange-300 text-orange-700 font-medium"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
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

      {/* 2. Photos (사진) */}
      {photos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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

      {/* 3. Map (지도) */}
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

      {/* 4. Elevation & Performance Chart (고도 & 성능 분석) */}
      {showStreamSpinner && isStrava && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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

      {/* 5. Stats grid (거리, 이동시간, 획득고도) */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
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

      {/* 6. Top Results (주요 성과) */}
      {topResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* Trophy header icon */}
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
              <h3 className="text-sm font-bold text-gray-900">주요 성과</h3>
            </div>
            {segmentEfforts.length > topResults.length && (
              <a href="#segments" className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                전체 보기
              </a>
            )}
          </div>
          <div className="space-y-1">
            {topResults.map((effort) => {
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
                  /* Crown icon - KOM */
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
                  /* Trophy icon - 1st PR */
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
                  /* Medal icon - 2nd PR */
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
                  /* Medal icon - 3rd PR */
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
                <div key={effort.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    {iconContent}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/segment/strava_${effort.segment.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-orange-600 transition-colors truncate block"
                    >
                      {effort.name}
                    </Link>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {(effort.segment.distance / 1000).toFixed(1)} km
                      {effort.segment.averageGrade > 0 && ` · ${effort.segment.averageGrade.toFixed(1)}%`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm ${badgeBg}`}>
                      {badgeText}
                    </span>
                    <span className="font-mono font-bold text-sm text-gray-900 tabular-nums">{formatTime(effort.elapsedTime)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Segment Efforts (세그먼트) */}
      {segmentEfforts.length > 0 && (
        <div id="segments" className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2">
              {/* Mountain/segment icon */}
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none">
                <path d="M2 20L8.5 8l4 6 3.5-5L22 20H2z" fill="#F97316" opacity="0.15" />
                <path d="M2 20L8.5 8l4 6 3.5-5L22 20" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8.5 8l4 6" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              세그먼트 ({segmentEfforts.length})
            </div>
            <div className="flex items-center gap-2 text-xs">
              {prCount > 0 && (
                <span className="bg-gradient-to-r from-yellow-50 to-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <path d="M13 3l-1.5 6L6 5l-2 10h16l-2-10-4.5 4L13 3z" fill="currentColor" opacity="0.6" />
                  </svg>
                  PR {prCount}
                </span>
              )}
              {komCount > 0 && (
                <span className="bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border border-orange-200 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                    <path d="M4 17h16l-2-10-4.5 4L12 5l-1.5 6L6 7l-2 10z" fill="currentColor" opacity="0.6" />
                  </svg>
                  KOM {komCount}
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
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm ${
                            effort.prRank === 1 ? "bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900" :
                            effort.prRank === 2 ? "bg-gradient-to-r from-slate-300 to-slate-400 text-white" :
                            "bg-gradient-to-r from-orange-300 to-orange-400 text-white"
                          }`}>
                            {effort.prRank === 1 ? "PR" : effort.prRank === 2 ? "2nd" : "3rd"}
                          </span>
                        )}
                        {isKOM && (
                          <span className="text-[11px] font-bold bg-gradient-to-r from-orange-500 to-orange-600 text-white px-2 py-0.5 rounded-full shadow-sm">
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

      {/* Co-riders (함께 탄 라이더) */}
      {coRiders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
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
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Avatar
                  name={r.nickname}
                  imageUrl={r.profileImage}
                  size="sm"
                  userId={r.userId}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{r.nickname}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span>{(r.summary.distance / 1000).toFixed(1)} km</span>
                    <span>{r.summary.averageSpeed.toFixed(1)} km/h</span>
                    {r.summary.averageHeartRate != null && <span>{r.summary.averageHeartRate} bpm</span>}
                    {r.summary.averagePower != null && <span>{r.summary.averagePower} W</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {formatDuration(r.summary.ridingTimeMillis)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Kudos + Comments */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-4 pb-3 border-b border-gray-100">
          <button
            onClick={handleToggleKudos}
            disabled={!user}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              liked ? "text-orange-500" : "text-gray-500 hover:text-orange-500"
            } disabled:opacity-50`}
          >
            <svg className="w-5 h-5" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            좋아요{activityKudos.length > 0 ? ` ${activityKudos.length}` : ""}
          </button>
          <span className="text-sm text-gray-500">
            댓글 {activityComments.length > 0 ? activityComments.length : "0"}
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
                    {user?.uid === c.userId && editingCommentId !== c.id && (
                      <span className="ml-auto flex gap-1">
                        <button
                          onClick={() => { setEditingCommentId(c.id); setEditingText(c.text); }}
                          className="text-xs text-gray-400 hover:text-orange-500"
                        >수정</button>
                        <button
                          onClick={() => { if (window.confirm("댓글을 삭제하시겠습니까?")) handleDeleteComment(c.id); }}
                          className="text-xs text-gray-400 hover:text-red-500"
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
                        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-orange-300"
                      />
                      <button onClick={handleSaveEditComment} disabled={!editingText.trim()} className="text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50">저장</button>
                      <button onClick={() => setEditingCommentId(null)} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 mt-0.5">{c.text}</p>
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
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-300"
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
    </div>
  );
}
