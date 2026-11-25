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
  readUnifiedTournamentState,
  type DerivedTournamentSummary,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store";

/**
 * Hook React temps reel partage entre `/`, `/ma-table`, `/classement`, `/equipe`, `/admin` et `/live`.
 * Ecoute simultanement :
 * - les mises a jour dans le meme onglet (`CustomEvent`)
 * - les mises a jour entre onglets (`BroadcastChannel("coincheirb-live")` et `storage` event).
 */
export function useTournamentStore(): {
  state: UnifiedTournamentState;
  summary: DerivedTournamentSummary;
  hydrated: boolean;
} {
  const [state, setState] = useState<UnifiedTournamentState>(() =>
    createDefaultUnifiedTournamentState(),
  );
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setState(readUnifiedTournamentState());
    setHydrated(true);

    const syncFromStorage = () => {
      setState(readUnifiedTournamentState());
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

    return () => {
      window.removeEventListener(UNIFIED_LOCAL_EVENT_NAME, syncFromStorage);
      window.removeEventListener("storage", handleStorageEvent);
      if (channel !== null) {
        channel.close();
      }
    };
  }, []);

  const summary = useMemo(() => deriveTournamentViews(state), [state]);

  return { state, summary, hydrated };
}
