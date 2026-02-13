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

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!nickname) {
    return (
      <div className="text-center py-12 text-gray-500">
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
          <div className="ring-4 ring-white rounded-full bg-white shadow-md">
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
          <h1 className="text-2xl font-bold">
            {nickname}
            {friendCode && <span className="text-sm font-normal text-blue-500 ml-2">({friendCode})</span>}
          </h1>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            <span><strong className="text-gray-900">{followerCount}</strong> 팔로워</span>
            <span><strong className="text-gray-900">{followingCount}</strong> 팔로잉</span>
          </div>
        </div>
        {!isMe && currentUser && (
          <button
            onClick={handleToggleFollow}
            disabled={followLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              following
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
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

      {/* Activity feed */}
      <div>
        <h2 className="text-lg font-semibold mb-3">최근 활동</h2>
        <div className="space-y-4">
          {activitiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              아직 활동이 없습니다.
            </p>
          ) : (
            activities.map((activity) => (
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
