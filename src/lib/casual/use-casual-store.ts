"use client";

import { useEffect, useState } from "react";
import {
  CASUAL_BROADCAST_CHANNEL,
  CASUAL_LOCAL_EVENT,
  CASUAL_STORE_KEY,
  createDefaultCasualGames,
  readCasualGames,
  type CasualGameRecord,
} from "@/lib/casual/casual-store";

export function useCasualGamesStore(): {
  games: CasualGameRecord[];
  hydrated: boolean;
} {
  const [games, setGames] = useState<CasualGameRecord[]>(() =>
    createDefaultCasualGames(),
  );
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setGames(readCasualGames());
    setHydrated(true);

    const refresh = () => {
      setGames(readCasualGames());
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === CASUAL_STORE_KEY) {
        refresh();
      }
    };

    window.addEventListener(CASUAL_LOCAL_EVENT, refresh);
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel(CASUAL_BROADCAST_CHANNEL);
        channel.onmessage = () => {
          refresh();
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      window.removeEventListener(CASUAL_LOCAL_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      if (channel !== null) {
        channel.close();
      }
    };
  }, []);

  return { games, hydrated };
}
