import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  collection, query, where, orderBy, getDocs,
  doc, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { ref, get } from "firebase/database";
import { firestore, database } from "../services/firebase";
import { useDocument } from "../hooks/useFirestore";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import ActivityCard from "../components/ActivityCard";
import Avatar from "../components/Avatar";
import WeeklyChart from "../components/WeeklyChart";
import type { Activity, UserProfile } from "@shared/types";

function formatHours(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AthletePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, profile: currentProfile } = useAuth();

  const { data: firestoreProfile, loading: profileLoading } = useDocument<UserProfile>("users", userId);

  const [firestoreActivities, setFirestoreActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  const [friendCode, setFriendCode] = useState<string | null>(null);

  // Follow state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Activity filter
  const [filterType, setFilterType] = useState<"all" | "ride" | "strava">("all");

  useEffect(() => {
    if (!userId) return;
    get(ref(database, `users/${userId}/friendCode`)).then((snap) => {
      if (snap.exists()) setFriendCode(snap.val());
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    setActivitiesLoading(true);
    const q = query(
      collection(firestore, "activities"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
    );
    getDocs(q)
      .then((snap) => {
        setFirestoreActivities(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity),
        );
      })
      .catch((err) => console.error("Failed to fetch activities:", err))
      .finally(() => setActivitiesLoading(false));
  }, [userId]);

  // Check if current user follows this profile
  useEffect(() => {
    if (!currentUser || !userId || currentUser.uid === userId) return;

    getDoc(doc(firestore, "following", currentUser.uid, "users", userId))
      .then((snap) => setFollowing(snap.exists()))
      .catch(() => {});
  }, [currentUser, userId]);

  // Fetch follower / following counts
  useEffect(() => {
    if (!userId) return;

    getDocs(collection(firestore, "followers", userId, "users"))
      .then((snap) => setFollowerCount(snap.size))
      .catch(() => {});
    getDocs(collection(firestore, "following", userId, "users"))
      .then((snap) => setFollowingCount(snap.size))
      .catch(() => {});
  }, [userId]);

  const handleToggleFollow = async () => {
    if (!currentUser || !userId || followLoading) return;

    setFollowLoading(true);
    const ref = doc(firestore, "following", currentUser.uid, "users", userId);
    try {
      if (following) {
        await deleteDoc(ref);
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      } else {
        await setDoc(ref, {
          userId: currentUser.uid,
          nickname: currentProfile?.nickname || currentUser.displayName || "",
          profileImage: currentProfile?.photoURL || currentUser.photoURL || null,
          createdAt: Date.now(),
        });
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (err) {
      console.error("Follow toggle failed:", err);
    } finally {
      setFollowLoading(false);
    }
  };

  const nickname = firestoreProfile?.nickname;
  const photoURL = firestoreProfile?.photoURL ?? null;
  const activities = firestoreActivities.map((a) =>
    !a.profileImage && photoURL ? { ...a, profileImage: photoURL } : a,
  );
  const isMe = currentUser?.uid === userId;

  const totalDistance = useMemo(
    () => activities.reduce((s, a) => s + a.summary.distance, 0),
    [activities],
  );
  const totalTime = useMemo(
    () => activities.reduce((s, a) => s + a.summary.ridingTimeMillis, 0),
    [activities],
  );
  const totalElevation = useMemo(
    () => activities.reduce((s, a) => s + a.summary.elevationGain, 0),
    [activities],
  );

  const monthlyStats = useMemo(() => {
    const months = new Map<string, { distance: number; time: number; elevation: number; rides: number }>();
    for (const a of activities) {
      const d = new Date(a.createdAt);
      const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = months.get(key) ?? { distance: 0, time: 0, elevation: 0, rides: 0 };
      existing.distance += a.summary.distance / 1000;
      existing.time += a.summary.ridingTimeMillis / 3600000;
      existing.elevation += a.summary.elevationGain;
      existing.rides += 1;
      months.set(key, existing);
    }
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, data]) => ({ week, ...data }));
  }, [activities]);

  const filteredActivities = activities.filter((a) => {
    if (filterType === "all") return true;
    const isStrava = (a as Activity & { source?: string }).source === "strava";
    return filterType === "strava" ? isStrava : !isStrava;
  });

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-40 animate-pulse" />
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-full bg-gray-300 dark:bg-gray-600 ring-4 ring-white dark:ring-gray-900 animate-pulse" />
          </div>
        </div>
        <div className="pt-8 space-y-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 h-20 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!nickname) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        사용자를 찾을 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cover + Profile */}
      <div className="relative">
        <div className="bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 rounded-xl h-40 relative overflow-hidden shadow-sm">
          {/* Decorative pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cover-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1.5" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cover-pattern)" />
          </svg>
        </div>
        <div className="absolute -bottom-10 left-6 flex items-end gap-4">
          <div className="ring-4 ring-white dark:ring-gray-900 rounded-full bg-white dark:bg-gray-900 shadow-md">
            {photoURL ? (
              <img
                src={photoURL}
                alt=""
                className="w-20 h-20 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <Avatar name={nickname} size="xl" />
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="pt-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            {nickname}
            {friendCode && <span className="text-sm font-normal text-blue-500 ml-2">({friendCode})</span>}
          </h1>
          <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
            <span><strong className="text-gray-900 dark:text-gray-50">{followerCount}</strong> 팔로워</span>
            <span><strong className="text-gray-900 dark:text-gray-50">{followingCount}</strong> 팔로잉</span>
          </div>
        </div>
        {!isMe && currentUser && (
          <button
            onClick={handleToggleFollow}
            disabled={followLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              following
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                : "bg-orange-500 text-white hover:bg-orange-600"
            } disabled:opacity-50`}
          >
            {followLoading ? "..." : following ? "팔로잉" : "팔로우"}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="총 활동"
          value={`${activities.length}회`}
          icon="🚴"
        />
        <StatCard
          label="총 거리"
          value={`${(totalDistance / 1000).toFixed(0)} km`}
          icon="📏"
        />
        <StatCard
          label="총 시간"
          value={formatHours(totalTime)}
          icon="⏱"
        />
        <StatCard
          label="총 획득고도"
          value={`${totalElevation.toLocaleString()} m`}
          icon="⛰"
        />
      </div>

      {/* Monthly activity trend chart */}
      {monthlyStats.length > 1 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">월별 활동 추이</h3>
          <WeeklyChart data={monthlyStats} dataKey="distance" height={160} />
        </div>
      )}

      {/* Activity feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">최근 활동</h2>
          <div className="flex gap-1">
            {([
              { id: "all" as const, label: "전체" },
              { id: "strava" as const, label: "Strava" },
              { id: "ride" as const, label: "직접 기록" },
            ]).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  filterType === f.id
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredActivities.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              아직 활동이 없습니다.
            </p>
          ) : (
            filteredActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                showMap={false}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
