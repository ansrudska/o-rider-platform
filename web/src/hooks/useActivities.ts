import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { firestore } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Activity } from "@shared/types";
import type { WeeklyStat } from "../components/WeeklyChart";

export function useActivities() {
  const { user } = useAuth();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(20);

  useEffect(() => {
    setDisplayCount(20);

    let q;
    if (user) {
      // Logged in: own activities (Strava + O-Rider)
      q = query(
        collection(firestore, "activities"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(500),
      );
    } else {
      // Not logged in: public activities from everyone
      q = query(
        collection(firestore, "activities"),
        where("visibility", "==", "everyone"),
        orderBy("createdAt", "desc"),
        limit(50),
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity);
      setActivities(items);
      setLoading(false);
    }, (err) => {
      console.error("[useActivities] Firestore error:", err);
      setActivities([]);
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const loadMore = () => setDisplayCount((prev) => prev + 20);
  const hasMore = displayCount < activities.length;

  return {
    activities: activities.slice(0, displayCount),
    totalCount: activities.length,
    loading,
    loadMore,
    hasMore,
  };
}

export function useWeeklyStats() {
  const { user } = useAuth();
  const { totalCount } = useActivities();

  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(firestore, "activities"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(500),
    );

    const unsub = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity));
    });

    return unsub;
  }, [user]);

  const emptyWeeks: WeeklyStat[] = [];
  const emptyThisWeek = { rides: 0, distance: 0, time: 0, elevation: 0 };

  if (!user) {
    return { weeklyStats: emptyWeeks, thisWeek: emptyThisWeek, totalCount: 0 };
  }

  const all = activities;
  const now = new Date();
  const weeks: WeeklyStat[] = [];
  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7 - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekActivities = all.filter(
      (a) => a.startTime >= weekStart.getTime() && a.startTime < weekEnd.getTime(),
    );

    weeks.push({
      week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      distance: Math.round(weekActivities.reduce((s, a) => s + a.summary.distance, 0) / 1000),
      time: Math.round(weekActivities.reduce((s, a) => s + a.summary.ridingTimeMillis, 0) / 3600000 * 10) / 10,
      elevation: Math.round(weekActivities.reduce((s, a) => s + a.summary.elevationGain, 0)),
      rides: weekActivities.length,
    });
  }

  const monday = new Date(now);
  monday.setDate(monday.getDate() - monday.getDay() + 1);
  monday.setHours(0, 0, 0, 0);
  const thisWeekActivities = all.filter((a) => a.startTime >= monday.getTime());

  return {
    weeklyStats: weeks,
    thisWeek: {
      rides: thisWeekActivities.length,
      distance: thisWeekActivities.reduce((s, a) => s + a.summary.distance, 0),
      time: thisWeekActivities.reduce((s, a) => s + a.summary.ridingTimeMillis, 0),
      elevation: thisWeekActivities.reduce((s, a) => s + a.summary.elevationGain, 0),
    },
    totalCount,
  };
}
