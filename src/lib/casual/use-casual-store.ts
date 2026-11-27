"use client";

import { useEffect, useState } from "react";
import {
  CASUAL_BROADCAST_CHANNEL,
  CASUAL_LOCAL_EVENT,
  CASUAL_STORE_KEY,
  PLAYER_DIRECTORY_STORE_KEY,
  createDefaultCasualGames,
  readCasualGames,
  readPlayerDirectory,
  type CasualGameRecord,
  type SchoolPlayerDirectoryEntry,
} from "@/lib/casual/casual-store";

export function useCasualGamesStore(): {
  games: CasualGameRecord[];
  directory: SchoolPlayerDirectoryEntry[];
  hydrated: boolean;
} {
  const [games, setGames] = useState<CasualGameRecord[]>(() =>
    createDefaultCasualGames(),
  );
  const [directory, setDirectory] = useState<SchoolPlayerDirectoryEntry[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setGames(readCasualGames());
    setDirectory(readPlayerDirectory());
    setHydrated(true);

    // Synchronisation distante silencieuse avec `/api/casual/sync`
    void fetch("/api/casual/sync", { method: "GET", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const payload = (await res.json().catch(() => null)) as {
          directory?: SchoolPlayerDirectoryEntry[];
          games?: CasualGameRecord[];
        } | null;
        if (payload === null) {
          return;
        }
        if (Array.isArray(payload.directory) && payload.directory.length > 0) {
          const localDir = readPlayerDirectory();
          const map = new Map<string, SchoolPlayerDirectoryEntry>();
          for (const item of localDir) {
            map.set(item.normalizedKey, item);
          }
          let added = false;
          for (const remoteItem of payload.directory) {
            if (!map.has(remoteItem.normalizedKey)) {
              map.set(remoteItem.normalizedKey, remoteItem);
              added = true;
            }
          }
          if (added) {
            const merged = Array.from(map.values());
            window.localStorage.setItem(
              PLAYER_DIRECTORY_STORE_KEY,
              JSON.stringify(merged),
            );
            setDirectory(merged);
          }
        }
      })
      .catch(() => {});

    const refresh = () => {
      setGames(readCasualGames());
      setDirectory(readPlayerDirectory());
    };

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === null ||
        e.key === CASUAL_STORE_KEY ||
        e.key === PLAYER_DIRECTORY_STORE_KEY
      ) {
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

  return { games, directory, hydrated };
}
