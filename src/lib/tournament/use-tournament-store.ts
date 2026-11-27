"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UNIFIED_BROADCAST_CHANNEL,
  UNIFIED_LOCAL_EVENT_NAME,
  UNIFIED_STORE_STORAGE_KEY,
} from "@/lib/tournament/live-store-types";
import {
  createDefaultUnifiedTournamentState,
  deriveTournamentViews,
  getRemoteSyncMeta,
  hydrateUnifiedStateFromRemote,
  readUnifiedTournamentState,
  setRemoteSyncMode,
  type DerivedTournamentSummary,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface RemoteStateResponse {
  mode?: "supabase" | "local_fallback";
  revision?: number;
  state?: UnifiedTournamentState | null;
  lastEvent?: unknown;
}

function hasPublicSupabaseBrowserEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || anon === undefined) {
    return false;
  }
  if (url.length < 16 || anon.length < 20 || url.includes("your-project-ref")) {
    return false;
  }
  return true;
}

/**
 * Hook React temps reel partage entre `/`, `/ma-table`, `/classement`, `/equipe`, `/admin` et `/live`.
 * Ecoute simultanement :
 * - les mises a jour locales (`CustomEvent`, `BroadcastChannel`, `storage`)
 * - la synchronisation serveur `/api/tournament/state` + Supabase Realtime (`tournament_live_snapshots`)
 *   avec repli local automatique si Supabase n'est pas configure.
 */
export function useTournamentStore(): {
  state: UnifiedTournamentState;
  summary: DerivedTournamentSummary;
  hydrated: boolean;
  syncMode: "supabase" | "local";
  syncRevision: number;
} {
  const [state, setState] = useState<UnifiedTournamentState>(() =>
    createDefaultUnifiedTournamentState(),
  );
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [syncMode, setSyncMode] = useState<"supabase" | "local">("local");
  const [syncRevision, setSyncRevision] = useState<number>(0);

  useEffect(() => {
    setState(readUnifiedTournamentState());
    const initialMeta = getRemoteSyncMeta();
    setSyncMode(initialMeta.syncMode);
    setSyncRevision(initialMeta.revision);
    setHydrated(true);

    const syncFromStorage = () => {
      setState(readUnifiedTournamentState());
      const meta = getRemoteSyncMeta();
      setSyncMode(meta.syncMode);
      setSyncRevision(meta.revision);
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === null || event.key === UNIFIED_STORE_STORAGE_KEY) {
        syncFromStorage();
      }
    };

    window.addEventListener(UNIFIED_LOCAL_EVENT_NAME, syncFromStorage);
    window.addEventListener("storage", handleStorageEvent);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel(UNIFIED_BROADCAST_CHANNEL);
        channel.onmessage = (msg: MessageEvent<unknown>) => {
          if (
            typeof msg.data === "object" &&
            msg.data !== null &&
            "kind" in msg.data &&
            (msg.data as { kind: unknown }).kind === "tournament_state_sync"
          ) {
            syncFromStorage();
          }
        };
      } catch {
        channel = null;
      }
    }

    let cancelled = false;
    let pollTimer: number | null = null;
    let cleanupSupabase: (() => void) | null = null;

    async function fetchRemoteSnapshot(): Promise<"supabase" | "local"> {
      try {
        const res = await fetch("/api/tournament/state", {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) {
          return "local";
        }
        const data = (await res.json()) as RemoteStateResponse;
        if (cancelled) {
          return "local";
        }
        if (data.mode === "supabase") {
          setRemoteSyncMode("supabase");
          setSyncMode("supabase");
          let rev = 0;
          if (typeof data.revision === "number") {
            rev = data.revision;
          }
          if (data.state !== undefined && data.state !== null) {
            hydrateUnifiedStateFromRemote({
              state: data.state,
              revision: rev,
              lastEvent: data.lastEvent,
              mode: "supabase",
            });
            setState(readUnifiedTournamentState());
          }
          setSyncRevision(getRemoteSyncMeta().revision);
          return "supabase";
        }
        setRemoteSyncMode("local");
        setSyncMode("local");
        return "local";
      } catch {
        return "local";
      }
    }

    async function bootstrapRealtimeSync() {
      const detectedMode = await fetchRemoteSnapshot();
      if (cancelled || detectedMode !== "supabase") {
        return;
      }

      if (hasPublicSupabaseBrowserEnv()) {
        try {
          const client = createSupabaseBrowserClient();
          const rtChannel = client
            .channel("coincheirb-live-snapshot-sync")
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "tournament_live_snapshots",
                filter: "id=eq.active-tournament",
              },
              (payload) => {
                const nextRow = payload.new as {
                  revision?: number;
                  state_json?: UnifiedTournamentState;
                  last_event_json?: unknown;
                } | null;
                if (nextRow === null || typeof nextRow !== "object") {
                  return;
                }
                const nextRev = Number(nextRow.revision) || 0;
                hydrateUnifiedStateFromRemote({
                  state: nextRow.state_json ?? null,
                  revision: nextRev,
                  lastEvent: nextRow.last_event_json ?? null,
                  mode: "supabase",
                });
                syncFromStorage();
              },
            )
            .subscribe();

          cleanupSupabase = () => {
            void client.removeChannel(rtChannel);
          };
        } catch {
          // Repli sur le polling de securite si le websocket est bloque
        }
      }

      pollTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void fetchRemoteSnapshot();
        }
      }, 5000);
    }

    void bootstrapRealtimeSync();

    return () => {
      cancelled = true;
      window.removeEventListener(UNIFIED_LOCAL_EVENT_NAME, syncFromStorage);
      window.removeEventListener("storage", handleStorageEvent);
      if (channel !== null) {
        channel.close();
      }
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      if (cleanupSupabase !== null) {
        cleanupSupabase();
      }
    };
  }, []);

  const summary = useMemo(() => deriveTournamentViews(state), [state]);

  return { state, summary, hydrated, syncMode, syncRevision };
}
