"use client";

import { useCallback, useEffect, useState } from "react";

export interface ClubAccountProfile {
  id: string;
  pseudo: string;
  firstName: string;
  schoolYear: string;
}

interface ClubAccountApiPayload {
  authenticated?: boolean;
  account?: ClubAccountProfile | null;
  verifiedPseudos?: string[];
  error?: string;
}

const CLUB_ACCOUNT_EVENT = "coincheirb-club-account-changed";

export function useClubAccount(): {
  account: ClubAccountProfile | null;
  verifiedPseudos: string[];
  loading: boolean;
  register: (params: {
    pseudo: string;
    firstName: string;
    password: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  login: (params: {
    pseudo: string;
    password: string;
  }) => Promise<{ ok: boolean; error: string | null }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [account, setAccount] = useState<ClubAccountProfile | null>(null);
  const [verifiedPseudos, setVerifiedPseudos] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/club-account", {
        method: "GET",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as ClubAccountApiPayload;
        setAccount(data.account ?? null);
        if (Array.isArray(data.verifiedPseudos)) {
          setVerifiedPseudos(data.verifiedPseudos);
        }
      }
    } catch {
      // Ignore erreur reseau
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(CLUB_ACCOUNT_EVENT, onChanged);
    return () => {
      window.removeEventListener(CLUB_ACCOUNT_EVENT, onChanged);
    };
  }, [refresh]);

  const register = useCallback(
    async (params: { pseudo: string; firstName: string; password: string }) => {
      try {
        const res = await fetch("/api/auth/club-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "register",
            pseudo: params.pseudo,
            firstName: params.firstName,
            password: params.password,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | ClubAccountApiPayload
          | null;
        if (!res.ok) {
          return {
            ok: false,
            error: data?.error ?? "Création de compte impossible.",
          };
        }
        setAccount(data?.account ?? null);
        if (Array.isArray(data?.verifiedPseudos)) {
          setVerifiedPseudos(data.verifiedPseudos);
        }
        window.dispatchEvent(new CustomEvent(CLUB_ACCOUNT_EVENT));
        return { ok: true, error: null };
      } catch {
        return { ok: false, error: "Erreur réseau lors de l'inscription." };
      }
    },
    [],
  );

  const login = useCallback(
    async (params: { pseudo: string; password: string }) => {
      try {
        const res = await fetch("/api/auth/club-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "login",
            pseudo: params.pseudo,
            password: params.password,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | ClubAccountApiPayload
          | null;
        if (!res.ok) {
          return {
            ok: false,
            error: data?.error ?? "Identifiants incorrects.",
          };
        }
        setAccount(data?.account ?? null);
        if (Array.isArray(data?.verifiedPseudos)) {
          setVerifiedPseudos(data.verifiedPseudos);
        }
        window.dispatchEvent(new CustomEvent(CLUB_ACCOUNT_EVENT));
        return { ok: true, error: null };
      } catch {
        return { ok: false, error: "Erreur réseau lors de la connexion." };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/club-account", { method: "DELETE" });
    } catch {
      // Ignore
    }
    setAccount(null);
    window.dispatchEvent(new CustomEvent(CLUB_ACCOUNT_EVENT));
  }, []);

  return {
    account,
    verifiedPseudos,
    loading,
    register,
    login,
    logout,
    refresh,
  };
}
