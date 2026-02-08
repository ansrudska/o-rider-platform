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

export function useActivities(maxItems = 30) {
  const { user, profile } = useAuth();
  const isStrava = !!user && !!profile?.stravaConnected;

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStrava || !user) {
      // Demo mode
      setActivities(demoActivities);
      setLoading(false);
      return;
    }

    // Firestore real data
    const q = query(
      collection(firestore, "activities"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(maxItems),
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity);
      setActivities(items);
      setLoading(false);
    }, () => {
      // Fallback to demo on error
      setActivities(demoActivities);
      setLoading(false);
    });

    return unsub;
  }, [isStrava, user, maxItems]);

  return { activities, loading, isDemo: !isStrava };
}

export function useWeeklyStats() {
  const { user, profile } = useAuth();
  const { activities } = useActivities(100);
  const isStrava = !!user && !!profile?.stravaConnected;

  if (!isStrava) {
    return {
      weeklyStats: getDemoWeeklyStats("rider_1"),
      thisWeek: getDemoThisWeekSummary("rider_1"),
    };
  }

  // Compute weekly stats from Firestore activities
  const now = new Date();
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - w * 7 - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekActivities = activities.filter(
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
  const thisWeekActivities = activities.filter((a) => a.startTime >= monday.getTime());

  return {
    weeklyStats: weeks,
    thisWeek: {
      rides: thisWeekActivities.length,
      distance: thisWeekActivities.reduce((s, a) => s + a.summary.distance, 0),
      time: thisWeekActivities.reduce((s, a) => s + a.summary.ridingTimeMillis, 0),
      elevation: thisWeekActivities.reduce((s, a) => s + a.summary.elevationGain, 0),
    },
  };
}
