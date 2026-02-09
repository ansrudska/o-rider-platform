import { useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../services/firebase";

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

export function useStrava() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectStrava = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem("strava_state", state);

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

  const importPage = async (page: number, perPage = 200) => {
    const fn = httpsCallable(functions, "stravaImportActivities", { timeout: 120_000 });
    const result = await fn({ page, perPage });
    return result.data as {
      imported: number;
      rides: number;
      totalActivities: number;
      hasMore: boolean;
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

  return {
    loading,
    error,
    connectStrava,
    exchangeCode,
    importAllActivities,
    getStreams,
    disconnectStrava,
  };
}
