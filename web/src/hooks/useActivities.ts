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
import { activities as demoActivities, getWeeklyStats as getDemoWeeklyStats, getThisWeekSummary as getDemoThisWeekSummary } from "../data/demo";
import type { Activity } from "@shared/types";

export function useActivities() {
  const { user, profile } = useAuth();
  const isStrava = !!user && !!profile?.stravaConnected;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(20);

  useEffect(() => {
    setDisplayCount(20);

    if (!isStrava || !user) {
      // Demo mode
      setActivities(demoActivities);
      setLoading(false);
      return;
    }

    // Firestore real data — fetch up to 500 for stats + pagination
    const q = query(
      collection(firestore, "activities"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(500),
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity);
      console.log("[useActivities] Firestore loaded:", items.length, "activities");
      setActivities(items);
      setLoading(false);
    }, (err) => {
      console.error("[useActivities] Firestore error, falling back to demo:", err);
      setActivities(demoActivities);
      setLoading(false);
    });

    return unsub;
  }, [isStrava, user]);

  const loadMore = () => setDisplayCount((prev) => prev + 20);
  const hasMore = displayCount < activities.length;

  return {
    activities: activities.slice(0, displayCount),
    totalCount: activities.length,
    loading,
    isDemo: !isStrava,
    loadMore,
    hasMore,
  };
}

export function useWeeklyStats() {
  const { user, profile } = useAuth();
  const { totalCount } = useActivities();
  const isStrava = !!user && !!profile?.stravaConnected;

  // Separate subscription for stats (needs all activities)
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    if (!isStrava || !user) return;

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
  }, [isStrava, user]);

  if (!isStrava) {
    return {
      weeklyStats: getDemoWeeklyStats("rider_1"),
      thisWeek: getDemoThisWeekSummary("rider_1"),
      totalCount: demoActivities.length,
    };
  }

  const all = activities;

  // Compute weekly stats from Firestore activities
  const now = new Date();
  const weeks = [];
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
