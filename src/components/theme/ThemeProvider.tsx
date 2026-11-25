"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "coincheirb-theme";
const THEME_SYNC_EVENT = "coincheirb-theme-sync";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.style.colorScheme = mode;
}

/**
 * Fournisseur de theme Coinch'Eirb.
 * Synchronise `data-theme` et `colorScheme` sur `<html>` sans conflit d'hydratation React 19
 * et propage le changement entre onglets.
 */
export function ThemeProvider(props: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    let initial: ThemeMode = "light";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") {
        initial = saved;
      } else {
        const attr = document.documentElement.getAttribute("data-theme");
        if (attr === "dark") {
          initial = "dark";
        }
      }
    } catch {
      initial = "light";
    }

    setThemeState(initial);
    applyThemeToDocument(initial);
    setMounted(true);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        if (event.newValue === "dark" || event.newValue === "light") {
          setThemeState(event.newValue);
          applyThemeToDocument(event.newValue);
        }
      }
    };

    const handleCustomSync = () => {
      try {
        const current = window.localStorage.getItem(STORAGE_KEY);
        if (current === "dark" || current === "light") {
          setThemeState(current);
          applyThemeToDocument(current);
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_SYNC_EVENT, handleCustomSync);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_SYNC_EVENT, handleCustomSync);
    };
  }, []);

  useEffect(() => {
    if (mounted) {
      applyThemeToDocument(theme);
    }
  }, [theme, mounted]);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
    applyThemeToDocument(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(THEME_SYNC_EVENT));
    } catch {
      // Ignore si stockage bloque
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      let next: ThemeMode = "dark";
      if (current === "dark") {
        next = "light";
      }
      applyThemeToDocument(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
        window.dispatchEvent(new CustomEvent(THEME_SYNC_EVENT));
      } catch {
        // Ignore si stockage bloque
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme doit etre utilise a l'interieur de ThemeProvider.");
  }
  return context;
}
