"use client";

import { useEffect, useState } from "react";
import {
  MEME_BANK_CHANNEL,
  MEME_BANK_LOCAL_EVENT,
  MEME_BANK_STORAGE_KEY,
  createDefaultMemeBankState,
  readMemeBankState,
  type MemeBankState,
} from "@/lib/memes/meme-bank";

export function useMemeBankStore(): {
  bank: MemeBankState;
  hydrated: boolean;
} {
  const [bank, setBank] = useState<MemeBankState>(() =>
    createDefaultMemeBankState(),
  );
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    setBank(readMemeBankState());
    setHydrated(true);

    const refresh = () => {
      setBank(readMemeBankState());
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === MEME_BANK_STORAGE_KEY) {
        refresh();
      }
    };

    window.addEventListener(MEME_BANK_LOCAL_EVENT, refresh);
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    if ("BroadcastChannel" in window) {
      try {
        channel = new BroadcastChannel(MEME_BANK_CHANNEL);
        channel.onmessage = () => {
          refresh();
        };
      } catch {
        channel = null;
      }
    }

    return () => {
      window.removeEventListener(MEME_BANK_LOCAL_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
      if (channel !== null) {
        channel.close();
      }
    };
  }, []);

  return { bank, hydrated };
}
