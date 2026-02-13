import { useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../services/firebase";
import type { MigrationScope } from "@shared/types";

const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID;
const REDIRECT_URI = "https://orider-1ce26.web.app/strava/callback";

export function useStrava() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const startMigration = useCallback(async (scope: MigrationScope) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaQueueEnqueue");
      const result = await fn({ scope });
      return result.data as { jobId: string; queuePosition: number };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Migration start failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelMigration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaQueueCancel");
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cancel failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

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

  const deleteUserData = async (streamsOnly = false) => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaDeleteUserData", { timeout: 300_000 });
      const result = await fn({ streamsOnly });
      return result.data as { deletedActivities: number; deletedStreams: number };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const verifyMigration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaMigrationVerify", { timeout: 300_000 });
      const result = await fn();
      return result.data as {
        totalStrava: number;
        totalImported: number;
        missingActivityCount: number;
        missingStreamCount: number;
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fixMigration = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "stravaMigrationFix");
      const result = await fn();
      return result.data as { activitiesImported: number; streamsQueued: number };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fix failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    connectStrava,
    exchangeCode,
    startMigration,
    cancelMigration,
    getStreams,
    disconnectStrava,
    deleteUserData,
    verifyMigration,
    fixMigration,
  };
}
