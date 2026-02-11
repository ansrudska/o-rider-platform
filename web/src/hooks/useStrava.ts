import { useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../services/firebase";
import type { MigrationScope, MigrationReport } from "@shared/types";

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const REDIRECT_URI = "https://orider-1ce26.web.app/strava/callback";

export interface ImportProgress {
  page: number;
  totalImported: number;
  totalRides: number;
  done: boolean;
  /** Latest page result */
  lastPageImported: number;
  lastPageRides: number;
}

export interface BatchStreamResult {
  fetched: number;
  failed: number;
  remaining: number;
  done: boolean;
  rateLimit: { paused: boolean; retryAfterSeconds: number };
}

function periodToAfter(period: string): number | undefined {
  const now = Math.floor(Date.now() / 1000);
  if (period === "recent_90") return now - 90 * 86400;
  if (period === "recent_180") return now - 180 * 86400;
  return undefined; // "all"
}

export function useStrava() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  const connectStrava = (returnTo?: string) => {
    const state = crypto.randomUUID();
    sessionStorage.setItem("strava_state", state);
    if (returnTo) sessionStorage.setItem("strava_return_to", returnTo);

    const params = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "read,activity:read_all",
      state,
    });

    window.location.href = `https://www.strava.com/oauth/authorize?${params}`;
  };

  const exchangeCode = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaExchangeToken");
      const result = await fn({ code });
      return result.data as { athleteId: number; firstname: string; lastname: string };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Token exchange failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const importPage = async (page: number, perPage = 200, after?: number, migrationMode?: boolean) => {
    const fn = httpsCallable(functions, "stravaImportActivities", { timeout: 300_000 });
    const result = await fn({ page, perPage, after, migrationMode });
    return result.data as {
      imported: number;
      skipped: number;
      rides: number;
      totalActivities: number;
      hasMore: boolean;
      photos: number;
      achievements: number;
      rateLimited?: boolean;
      retryAfterSeconds?: number;
    };
  };

  const importAllActivities = useCallback(
    async (onProgress: (progress: ImportProgress) => void) => {
      setLoading(true);
      setError(null);
      try {
        let page = 1;
        let totalImported = 0;
        let totalRides = 0;

        while (true) {
          const result = await importPage(page);
          totalImported += result.imported;
          totalRides += result.rides;

          const done = !result.hasMore;
          onProgress({
            page,
            totalImported,
            totalRides,
            done,
            lastPageImported: result.imported,
            lastPageRides: result.rides,
          });

          if (done) break;
          page++;
        }

        return { totalImported, totalRides, pages: page };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Import failed";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const startMigration = async (scope: MigrationScope) => {
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaMigrationStart");
      await fn({ scope });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Migration start failed";
      setError(msg);
      throw e;
    }
  };

  const batchFetchStreams = useCallback(
    async (scope: MigrationScope) => {
      const fn = httpsCallable<
        { batchSize: number; includePhotos: boolean; includeSegments: boolean },
        BatchStreamResult
      >(functions, "stravaBatchFetchStreams", { timeout: 300_000 });

      while (true) {
        const result = await fn({
          batchSize: 10,
          includePhotos: scope.includePhotos,
          includeSegments: scope.includeSegments,
        });
        const data = result.data;

        if (data.done) break;

        if (data.rateLimit.paused) {
          const waitSec = data.rateLimit.retryAfterSeconds;
          // Countdown timer
          setRateLimitCountdown(waitSec);
          await new Promise<void>((resolve) => {
            let remaining = waitSec;
            const interval = setInterval(() => {
              remaining--;
              setRateLimitCountdown(remaining);
              if (remaining <= 0) {
                clearInterval(interval);
                resolve();
              }
            }, 1000);
          });
          setRateLimitCountdown(0);
          // Continue loop to retry
        }
      }
    },
    [],
  );

  const importMigrationActivities = useCallback(
    async (scope: MigrationScope) => {
      setLoading(true);
      setError(null);
      try {
        // Phase 1: Import activity list
        const after = periodToAfter(scope.period);
        let page = 1;

        while (true) {
          const result = await importPage(page, 200, after, true);

          // Rate limited — wait and retry same page
          if (result.rateLimited) {
            const waitSec = result.retryAfterSeconds ?? 60;
            setRateLimitCountdown(waitSec);
            await new Promise<void>((resolve) => {
              let remaining = waitSec;
              const interval = setInterval(() => {
                remaining--;
                setRateLimitCountdown(remaining);
                if (remaining <= 0) {
                  clearInterval(interval);
                  resolve();
                }
              }, 1000);
            });
            setRateLimitCountdown(0);
            continue; // Retry same page
          }

          if (!result.hasMore) break;
          page++;
        }

        // Phase 2: Batch fetch streams (if photos or segments requested)
        if (scope.includePhotos || scope.includeSegments) {
          await batchFetchStreams(scope);
        }

        // Migration complete — generate report
        const completeFn = httpsCallable(functions, "stravaMigrationComplete");
        const reportResult = await completeFn();
        return reportResult.data as MigrationReport;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Migration failed";
        setError(msg);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [batchFetchStreams],
  );

  const getStreams = async (stravaActivityId: number) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaGetActivityStreams");
      const result = await fn({ stravaActivityId });
      return result.data as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stream fetch failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const disconnectStrava = async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaDisconnect");
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Disconnect failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const deleteUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaDeleteUserData", { timeout: 300_000 });
      const result = await fn();
      return result.data as { deletedActivities: number; deletedStreams: number };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    rateLimitCountdown,
    connectStrava,
    exchangeCode,
    importAllActivities,
    startMigration,
    importMigrationActivities,
    batchFetchStreams,
    getStreams,
    disconnectStrava,
    deleteUserData,
  };
}
