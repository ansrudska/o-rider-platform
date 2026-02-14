import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  collection, query, where, orderBy, getDocs,
  doc, getDoc, setDoc, deleteDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, get } from "firebase/database";
import { firestore, database, functions } from "../services/firebase";
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

  // Friend state: 'none' | 'request_sent' | 'request_received' | 'friends'
  const [friendStatus, setFriendStatus] = useState<"none" | "request_sent" | "request_received" | "friends">("none");
  const [friendLoading, setFriendLoading] = useState(false);
  const [friendCount, setFriendCount] = useState(0);

  // Friend list
  const [friends, setFriends] = useState<{ userId: string; nickname: string; profileImage: string | null }[]>([]);
  const [friendsOpen, setFriendsOpen] = useState(false);

  // Activity filter
  const [filterType, setFilterType] = useState<"all" | "ride" | "strava">("all");

  useEffect(() => {
    if (!userId || !database) return;
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

  // Check friend relationship
  useEffect(() => {
    if (!currentUser || !userId || currentUser.uid === userId) return;

    // 1. 이미 친구인지 확인
    getDoc(doc(firestore, "friends", currentUser.uid, "users", userId))
      .then((snap) => {
        if (snap.exists()) {
          setFriendStatus("friends");
          return;
        }
        // 2. 내가 요청을 보냈는지 확인
        return getDoc(doc(firestore, "friend_requests", userId, "items", currentUser.uid))
          .then((reqSnap) => {
            if (reqSnap.exists()) {
              setFriendStatus("request_sent");
              return;
            }
            // 3. 상대가 나에게 요청을 보냈는지 확인
            return getDoc(doc(firestore, "friend_requests", currentUser.uid, "items", userId))
              .then((recvSnap) => {
                setFriendStatus(recvSnap.exists() ? "request_received" : "none");
              });
          });
      })
      .catch(() => {});
  }, [currentUser, userId]);

  // Fetch friend list + count
  useEffect(() => {
    if (!userId) return;

    getDocs(collection(firestore, "friends", userId, "users"))
      .then((snap) => {
        setFriendCount(snap.size);
        setFriends(snap.docs.map((d) => {
          const data = d.data();
          return {
            userId: d.id,
            nickname: data.nickname || "",
            profileImage: data.profileImage || null,
          };
        }));
      })
      .catch(() => {});
  }, [userId]);

  const handleSendFriendRequest = async () => {
    if (!currentUser || !userId || friendLoading) return;
    setFriendLoading(true);
    try {
      await setDoc(doc(firestore, "friend_requests", userId, "items", currentUser.uid), {
        requesterId: currentUser.uid,
        nickname: currentProfile?.nickname || currentUser.displayName || "",
        profileImage: currentProfile?.photoURL || currentUser.photoURL || null,
        createdAt: Date.now(),
      });
      setFriendStatus("request_sent");
    } catch (err) {
      console.error("Friend request failed:", err);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!currentUser || !userId || friendLoading) return;
    setFriendLoading(true);
    try {
      await deleteDoc(doc(firestore, "friend_requests", userId, "items", currentUser.uid));
      setFriendStatus("none");
    } catch (err) {
      console.error("Cancel request failed:", err);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser || !userId || friendLoading) return;
    setFriendLoading(true);
    try {
      const accept = httpsCallable(functions, "acceptFriendRequest");
      await accept({ requesterId: userId });
      setFriendStatus("friends");
      setFriendCount((c) => c + 1);
    } catch (err) {
      console.error("Accept request failed:", err);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleRemoveFriend = async (targetId?: string) => {
    const removeId = targetId || userId;
    if (!currentUser || !removeId || friendLoading) return;
    setFriendLoading(true);
    try {
      await deleteDoc(doc(firestore, "friends", currentUser.uid, "users", removeId));
      if (!targetId || targetId === userId) {
        setFriendStatus("none");
      }
      setFriendCount((c) => Math.max(0, c - 1));
      setFriends((prev) => prev.filter((f) => f.userId !== removeId));
    } catch (err) {
      console.error("Remove friend failed:", err);
    } finally {
      setFriendLoading(false);
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
            <button
              onClick={() => setFriendsOpen(!friendsOpen)}
              className="hover:text-orange-500 transition-colors"
            >
              <strong className="text-gray-900 dark:text-gray-50">{friendCount}</strong> 친구
            </button>
          </div>
        </div>
        {!isMe && currentUser && (
          <div className="flex gap-2">
            {friendStatus === "none" && (
              <button
                onClick={handleSendFriendRequest}
                disabled={friendLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {friendLoading ? "..." : "친구 요청"}
              </button>
            )}
            {friendStatus === "request_sent" && (
              <button
                onClick={handleCancelRequest}
                disabled={friendLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {friendLoading ? "..." : "요청 취소"}
              </button>
            )}
            {friendStatus === "request_received" && (
              <button
                onClick={handleAcceptRequest}
                disabled={friendLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {friendLoading ? "..." : "수락"}
              </button>
            )}
            {friendStatus === "friends" && (
              <button
                onClick={() => handleRemoveFriend()}
                disabled={friendLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {friendLoading ? "..." : "친구"}
              </button>
            )}
          </div>
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

      {/* Friend list */}
      {friendsOpen && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">친구 ({friendCount})</h3>
            <button
              onClick={() => setFriendsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {friends.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              아직 친구가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {friends.map((f) => (
                <div key={f.userId} className="px-4 py-3 flex items-center gap-3">
                  <Link to={`/athlete/${f.userId}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {f.profileImage ? (
                      <img src={f.profileImage} alt="" className="w-9 h-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Avatar name={f.nickname} size="sm" />
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-50 truncate">{f.nickname}</span>
                  </Link>
                  {isMe && (
                    <button
                      onClick={() => handleRemoveFriend(f.userId)}
                      disabled={friendLoading}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 shrink-0"
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
