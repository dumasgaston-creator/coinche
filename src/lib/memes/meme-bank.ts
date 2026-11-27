import { sanitizePlainName } from "@/lib/security/sanitize";

export const MEME_BANK_STORAGE_KEY = "coincheirb-meme-bank-v1";
export const MEME_BANK_CHANNEL = "coincheirb-memes-sync";
export const MEME_BANK_LOCAL_EVENT = "coincheirb-memes-updated";

export type MemeCategory =
  | "coinche"
  | "capot"
  | "generale"
  | "chute"
  | "elimination"
  | "ambiance";

export interface MemeCategoryMeta {
  id: MemeCategory;
  label: string;
}

export const MEME_CATEGORIES: readonly MemeCategoryMeta[] = [
  { id: "coinche", label: "Coinche / Surcoinche" },
  { id: "capot", label: "Capot" },
  { id: "generale", label: "Générale" },
  { id: "chute", label: "Contrat chuté" },
  { id: "elimination", label: "Éliminé (Capri-Seum)" },
  { id: "ambiance", label: "Ambiance BAR" },
];

export interface CommunityMemeItem {
  id: string;
  imageUrl: string;
  caption: string;
  authorName: string;
  category: MemeCategory;
  status: "approved" | "pending";
  isBuiltin: boolean;
  createdAt: string;
}

export interface MemeBankState {
  moderationRequired: boolean;
  items: CommunityMemeItem[];
}

const BUILTIN_MEMES: readonly CommunityMemeItem[] = [
  {
    id: "builtin-capri-elim",
    imageUrl: "/assets/media/meme-capri-seum.jpg",
    caption: "Capri-Seum · Le bon goût de la défaite",
    authorName: "Coinch'Eirb",
    category: "elimination",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:00:00.000Z",
  },
  {
    id: "builtin-capri-chute",
    imageUrl: "/assets/media/meme-capri-seum.jpg",
    caption: "Chuté · Un Capri-Seum bien frais",
    authorName: "Coinch'Eirb",
    category: "chute",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:01:00.000Z",
  },
  {
    id: "builtin-langue-chute",
    imageUrl: "/assets/media/meme-tete-langue.jpg",
    caption: "La défense en roue libre",
    authorName: "Bureau BAR",
    category: "chute",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:02:00.000Z",
  },
  {
    id: "builtin-generale-hand",
    imageUrl: "/assets/media/meme-generale.jpg",
    caption: "La vraie main de Générale",
    authorName: "Coinch'Eirb",
    category: "generale",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:03:00.000Z",
  },
  {
    id: "builtin-coinche-labelle",
    imageUrl: "/assets/media/meme-voulez-vous-coincher.jpg",
    caption: "Voulez-vous coincher avec moi ce soir ?",
    authorName: "Coinch'Eirb",
    category: "coinche",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:04:00.000Z",
  },
  {
    id: "builtin-coinche-sourire",
    imageUrl: "/assets/media/meme-tete-sourire.jpg",
    caption: "Le petit sourire quand la coinche passe",
    authorName: "Bureau BAR",
    category: "coinche",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:05:00.000Z",
  },
  {
    id: "builtin-capot-langue",
    imageUrl: "/assets/media/meme-tete-langue.jpg",
    caption: "Capot validé · 250 pts propres",
    authorName: "Coinch'Eirb",
    category: "capot",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:06:00.000Z",
  },
  {
    id: "builtin-capot-table",
    imageUrl: "/assets/media/soiree-table-cartes.jpg",
    caption: "8 plis sur 8 autour du tapis vert",
    authorName: "Coinch'Eirb",
    category: "capot",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:07:00.000Z",
  },
  {
    id: "builtin-ambiance-bar",
    imageUrl: "/assets/media/soiree-foyer-bar.jpg",
    caption: "Au BAR de l'ENSEIRB-MATMECA",
    authorName: "Coinch'Eirb",
    category: "ambiance",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:08:00.000Z",
  },
  {
    id: "builtin-ambiance-duo",
    imageUrl: "/assets/media/soiree-duo.jpg",
    caption: "Ambiance soirée Coinch'Eirb",
    authorName: "Coinch'Eirb",
    category: "ambiance",
    status: "approved",
    isBuiltin: true,
    createdAt: "2026-11-20T18:09:00.000Z",
  },
];

const lastPickedByCategory = new Map<string, string>();

export function createDefaultMemeBankState(): MemeBankState {
  return {
    moderationRequired: true,
    items: BUILTIN_MEMES.map((m) => ({ ...m })),
  };
}

export function readMemeBankState(): MemeBankState {
  if (typeof window === "undefined") {
    return createDefaultMemeBankState();
  }
  try {
    const raw = window.localStorage.getItem(MEME_BANK_STORAGE_KEY);
    if (raw !== null && raw.length > 0) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "items" in parsed &&
        Array.isArray((parsed as { items: unknown }).items)
      ) {
        return parsed as MemeBankState;
      }
    }
  } catch {
    // Ignore
  }
  const fresh = createDefaultMemeBankState();
  writeMemeBankState(fresh);
  return fresh;
}

export function writeMemeBankState(next: MemeBankState): MemeBankState {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MEME_BANK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        "Stockage local saturé : supprimez quelques anciens memes dans /admin.",
      );
    }
    try {
      window.dispatchEvent(new CustomEvent(MEME_BANK_LOCAL_EVENT));
    } catch {
      // Ignore
    }
    if ("BroadcastChannel" in window) {
      try {
        const ch = new BroadcastChannel(MEME_BANK_CHANNEL);
        ch.postMessage({ kind: "meme_bank_sync", count: next.items.length });
        ch.close();
      } catch {
        // Ignore
      }
    }
  }
  return next;
}

const MAX_COMMUNITY_MEMES = 40;
const MAX_DATA_URL_LENGTH = 620_000;
const recentSubmissionTimestamps: number[] = [];

/**
 * Verifie que l'URL d'un meme est strictement sure :
 * - soit un asset statique interne (`/assets/...` sans traversee `..`)
 * - soit un Data URL image raster autorise (`jpeg`, `png`, `webp`), jamais `svg+xml` ni `javascript:`.
 */
export function isSafeMemeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DATA_URL_LENGTH) {
    return false;
  }
  if (trimmed.startsWith("/assets/") && !trimmed.includes("..")) {
    return true;
  }
  if (
    trimmed.startsWith("data:image/jpeg;base64,") ||
    trimmed.startsWith("data:image/png;base64,") ||
    trimmed.startsWith("data:image/webp;base64,")
  ) {
    return true;
  }
  return false;
}

export function submitCommunityMeme(params: {
  imageUrl: string;
  caption: string;
  authorName: string;
  category: MemeCategory;
}): { state: MemeBankState; item: CommunityMemeItem } {
  if (!isSafeMemeImageUrl(params.imageUrl)) {
    throw new Error(
      "Format d'image non autorisé (seuls JPEG, PNG et WebP compressés sont acceptés).",
    );
  }

  const now = Date.now();
  while (
    recentSubmissionTimestamps.length > 0 &&
    now - (recentSubmissionTimestamps[0] ?? 0) > 60_000
  ) {
    recentSubmissionTimestamps.shift();
  }
  if (recentSubmissionTimestamps.length >= 6) {
    throw new Error(
      "Trop d'envois en moins d'une minute. Patientez quelques secondes avant d'ajouter un autre meme.",
    );
  }

  const current = readMemeBankState();
  const communityCount = current.items.filter((m) => !m.isBuiltin).length;
  if (communityCount >= MAX_COMMUNITY_MEMES) {
    throw new Error(
      "Limite atteinte (40 memes communautaires). Demandez à l'admin d'en retirer dans /admin.",
    );
  }

  const cleanCaption = sanitizePlainName(params.caption).slice(0, 80);
  const cleanAuthor = sanitizePlainName(params.authorName).slice(0, 40);

  let status: "approved" | "pending" = "approved";
  if (current.moderationRequired) {
    status = "pending";
  }

  let finalCaption = cleanCaption;
  if (finalCaption.length === 0) {
    finalCaption = "Meme Coinch'Eirb";
  }
  let finalAuthor = cleanAuthor;
  if (finalAuthor.length === 0) {
    finalAuthor = "Anonyme BAR";
  }

  const item: CommunityMemeItem = {
    id: `meme-${now}-${Math.floor(Math.random() * 10000)}`,
    imageUrl: params.imageUrl,
    caption: finalCaption,
    authorName: finalAuthor,
    category: params.category,
    status,
    isBuiltin: false,
    createdAt: new Date().toISOString(),
  };

  recentSubmissionTimestamps.push(now);

  const next = writeMemeBankState({
    ...current,
    items: [item, ...current.items],
  });

  return { state: next, item };
}

export function setMemeModerationRequired(required: boolean): MemeBankState {
  const current = readMemeBankState();
  return writeMemeBankState({
    ...current,
    moderationRequired: required,
  });
}

export function approveCommunityMeme(memeId: string): MemeBankState {
  const current = readMemeBankState();
  return writeMemeBankState({
    ...current,
    items: current.items.map((item) => {
      if (item.id === memeId) {
        return { ...item, status: "approved" as const };
      }
      return item;
    }),
  });
}

export function deleteCommunityMeme(memeId: string): MemeBankState {
  const current = readMemeBankState();
  return writeMemeBankState({
    ...current,
    items: current.items.filter((item) => item.id !== memeId),
  });
}

/**
 * Selectionne un meme approuve pour une categorie donnee avec garantie anti-repetition :
 * ne retourne jamais 2 fois de suite le meme visuel des qu'il y a >= 2 memes disponibles.
 */
export function pickNonRepeatingMeme(
  items: readonly CommunityMemeItem[],
  category: MemeCategory,
  lastIdOverride?: string | null,
  randomFn: () => number = Math.random,
): CommunityMemeItem | null {
  const approvedInCategory = items.filter(
    (m) => m.status === "approved" && m.category === category,
  );

  let pool = approvedInCategory;
  if (pool.length === 0) {
    pool = items.filter((m) => m.status === "approved");
  }
  if (pool.length === 0) {
    return null;
  }

  let previousId = lastPickedByCategory.get(category) ?? null;
  if (lastIdOverride !== undefined) {
    previousId = lastIdOverride;
  }

  let candidates = pool;
  if (pool.length > 1 && previousId !== null) {
    const filtered = pool.filter((m) => m.id !== previousId);
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  const idx = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(randomFn() * candidates.length)),
  );
  const chosen = candidates[idx] ?? candidates[0] ?? null;
  if (chosen !== null) {
    lastPickedByCategory.set(category, chosen.id);
  }
  return chosen;
}
