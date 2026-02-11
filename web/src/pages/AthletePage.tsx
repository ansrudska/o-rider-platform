import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { firestore } from "../services/firebase";
import { useDocument } from "../hooks/useFirestore";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import ActivityCard from "../components/ActivityCard";
import Avatar from "../components/Avatar";
import type { Activity, UserProfile } from "@shared/types";
import {
  riders,
  getActivitiesForUser,
} from "../data/demo";

function formatHours(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function AthletePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();

  // Try Firestore profile first
  const { data: firestoreProfile, loading: profileLoading } = useDocument<UserProfile>("users", userId);

  // Fallback to demo rider
  const demoRider = riders.find((r) => r.id === userId);

  // Firestore activities for real users
  const [firestoreActivities, setFirestoreActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  useEffect(() => {
    if (!userId || demoRider) return;

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
  }, [userId, demoRider]);

  // Choose data source
  const nickname = firestoreProfile?.nickname ?? demoRider?.nickname;
  const photoURL = firestoreProfile?.photoURL ?? null;
  const activities = demoRider
    ? getActivitiesForUser(userId ?? "")
    : firestoreActivities;

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
      <div className="bg-gradient-to-r from-orange-400 to-orange-600 rounded-lg h-36 relative">
        <div className="absolute -bottom-10 left-6 flex items-end gap-4">
          <div className="ring-4 ring-white rounded-full bg-white">
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
          <h1 className="text-2xl font-bold">{nickname}</h1>
          {firestoreProfile?.email && (
            <p className="text-gray-500 text-sm mt-0.5">{firestoreProfile.email}</p>
          )}
          {demoRider?.bio && (
            <p className="text-gray-500 text-sm mt-0.5">{demoRider.bio}</p>
          )}
        </div>
        {!isMe && (
          <button className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
            팔로우
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
