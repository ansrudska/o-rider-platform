import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  type QueryConstraint,
} from "firebase/firestore";
import { firestore } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Activity } from "@shared/types";
import type { WeeklyStat } from "../components/WeeklyChart";

export type DatePreset = "all" | "7d" | "30d" | "90d" | "year";

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
      elevation: Math.round(thisWeekActivities.reduce((s, a) => s + a.summary.elevationGain, 0)),
    },
    totalCount,
  };
}

function getDateFrom(preset: DatePreset): number | null {
  if (preset === "all") return null;
  const now = new Date();
  switch (preset) {
    case "7d":
      return now.getTime() - 7 * 86400000;
    case "30d":
      return now.getTime() - 30 * 86400000;
    case "90d":
      return now.getTime() - 90 * 86400000;
    case "year": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return yearStart.getTime();
    }
  }
}

export function useActivitySearch() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const cachedPresetRef = useRef<DatePreset | null>(null);

  const active = keyword.length > 0 || datePreset !== "all";

  // Fetch all activities from Firestore when search becomes active or datePreset changes
  useEffect(() => {
    if (!active) {
      setAllActivities([]);
      cachedPresetRef.current = null;
      return;
    }

    // Only re-query if datePreset changed
    if (cachedPresetRef.current === datePreset) return;

    setLoading(true);
    const constraints: QueryConstraint[] = user
      ? [where("userId", "==", user.uid)]
      : [where("visibility", "==", "everyone")];
    constraints.push(orderBy("startTime", "desc"));

    const dateFrom = getDateFrom(datePreset);
    if (dateFrom !== null) {
      constraints.push(where("startTime", ">=", dateFrom));
    }

    const q = query(collection(firestore, "activities"), ...constraints);

    getDocs(q).then((snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Activity);
      setAllActivities(items);
      cachedPresetRef.current = datePreset;
      setLoading(false);
    }).catch((err) => {
      console.error("[useActivitySearch] Firestore error:", err);
      setAllActivities([]);
      setLoading(false);
    });
  }, [user, active, datePreset]);

  // Reset displayCount when filters change
  useEffect(() => {
    setDisplayCount(20);
  }, [keyword, datePreset]);

  const results = useMemo(() => {
    if (!active) return [];
    const kw = keyword.toLowerCase().trim();
    if (!kw) return allActivities;
    return allActivities.filter(
      (a) => a.description?.toLowerCase().includes(kw) || a.nickname?.toLowerCase().includes(kw),
    );
  }, [active, keyword, allActivities]);

  const loadMore = useCallback(() => setDisplayCount((prev) => prev + 20), []);
  const hasMore = displayCount < results.length;

  const reset = useCallback(() => {
    setKeyword("");
    setDatePreset("all");
    setAllActivities([]);
    cachedPresetRef.current = null;
  }, []);

  return {
    keyword,
    setKeyword,
    datePreset,
    setDatePreset,
    results: results.slice(0, displayCount),
    totalResults: results.length,
    loading,
    loadMore,
    hasMore,
    active,
    reset,
  };
}
