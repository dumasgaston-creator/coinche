import { isSafeMemeImageUrl } from "@/lib/memes/meme-bank";
import { sanitizePlainName } from "@/lib/security/sanitize";

export const WINNERS_GALLERY_STORAGE_KEY = "coincheirb-winners-gallery-v1";
export const WINNERS_GALLERY_CHANNEL = "coincheirb-winners-sync";
export const WINNERS_GALLERY_LOCAL_EVENT = "coincheirb-winners-updated";

export const DEFAULT_LATEST_WINNER_PHOTO_URL =
  "/assets/vainqueurs/vainqueur-01.jpg";

export interface WinnerPhotoRecord {
  id: string;
  imageUrl: string;
  caption: string;
  isBuiltin: boolean;
  addedAt: string;
}

const BUILTIN_WINNER_PHOTOS: readonly WinnerPhotoRecord[] = [
  {
    id: "winner-builtin-01",
    imageUrl: "/assets/vainqueurs/vainqueur-01.jpg",
    caption: "Derniers vainqueurs · Au BAR",
    isBuiltin: true,
    addedAt: "2026-11-25T22:59:00.000Z",
  },
  {
    id: "winner-builtin-02",
    imageUrl: "/assets/vainqueurs/vainqueur-02.jpg",
    caption: "Anciens champions · Coinch'Eirb",
    isBuiltin: true,
    addedAt: "2026-11-20T22:00:00.000Z",
  },
];

const MAX_CUSTOM_WINNER_PHOTOS = 20;
let lastPickedWinnerPhotoId: string | null = null;

export function createDefaultWinnersGallery(): WinnerPhotoRecord[] {
  return BUILTIN_WINNER_PHOTOS.map((entry) => ({ ...entry }));
}

export function readWinnersGallery(): WinnerPhotoRecord[] {
  if (typeof window === "undefined") {
    return createDefaultWinnersGallery();
  }
  try {
    const raw = window.localStorage.getItem(WINNERS_GALLERY_STORAGE_KEY);
    if (raw !== null && raw.length > 0) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const stored = parsed as WinnerPhotoRecord[];
        // Garantit que les photos officielles du dossier public/assets/vainqueurs/ sont toujours presentes
        const existingIds = new Set(stored.map((item) => item.id));
        const merged: WinnerPhotoRecord[] = [...stored];
        for (const builtin of BUILTIN_WINNER_PHOTOS) {
          if (!existingIds.has(builtin.id)) {
            merged.push({ ...builtin });
          }
        }
        return merged;
      }
    }
  } catch {
    // Ignore
  }
  return createDefaultWinnersGallery();
}

function writeWinnersGallery(
  next: WinnerPhotoRecord[],
): WinnerPhotoRecord[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        WINNERS_GALLERY_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      throw new Error(
        "Dossier vainqueurs plein en stockage local. Retirez d'anciennes photos dans /admin.",
      );
    }
    try {
      window.dispatchEvent(new CustomEvent(WINNERS_GALLERY_LOCAL_EVENT));
    } catch {
      // Ignore
    }
    if ("BroadcastChannel" in window) {
      try {
        const ch = new BroadcastChannel(WINNERS_GALLERY_CHANNEL);
        ch.postMessage({ kind: "winners_gallery_sync", count: next.length });
        ch.close();
      } catch {
        // Ignore
      }
    }
  }
  return next;
}

/**
 * Ajoute une nouvelle photo de vainqueurs dans le Dossier Vainqueurs
 * (automatiquement appelee quand l'admin uploade les champions du soir).
 */
export function addWinnerPhotoToGallery(params: {
  imageUrl: string;
  caption: string;
}): WinnerPhotoRecord[] {
  if (!isSafeMemeImageUrl(params.imageUrl)) {
    throw new Error(
      "Format photo non autorisé (seuls JPEG, PNG et WebP sont acceptés).",
    );
  }
  const current = readWinnersGallery();
  const customOnly = current.filter((item) => !item.isBuiltin);
  if (customOnly.length >= MAX_CUSTOM_WINNER_PHOTOS) {
    throw new Error(
      "Limite de 20 photos personnalisées atteinte dans le dossier vainqueurs.",
    );
  }

  let cleanCaption = sanitizePlainName(params.caption).slice(0, 70);
  if (cleanCaption.length === 0) {
    cleanCaption = "Vainqueurs Coinch'Eirb";
  }

  const record: WinnerPhotoRecord = {
    id: `winner-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    imageUrl: params.imageUrl,
    caption: cleanCaption,
    isBuiltin: false,
    addedAt: new Date().toISOString(),
  };

  return writeWinnersGallery([record, ...current]);
}

export function removeWinnerPhotoFromGallery(
  photoId: string,
): WinnerPhotoRecord[] {
  const current = readWinnersGallery();
  const filtered = current.filter((item) => {
    if (item.id === photoId && !item.isBuiltin) {
      return false;
    }
    return true;
  });
  return writeWinnersGallery(filtered);
}

/**
 * Tire aleatoirement une photo dans le Dossier Vainqueurs pour le pop-up « Tu y es presque ! »
 * sans jamais afficher deux fois de suite la meme photo des qu'il y a >= 2 photos.
 */
export function pickRandomPreviousWinnerPhoto(
  photos: readonly WinnerPhotoRecord[] = readWinnersGallery(),
  lastIdOverride?: string | null,
  randomFn: () => number = Math.random,
): WinnerPhotoRecord {
  let safePool: readonly WinnerPhotoRecord[] = photos;
  if (safePool.length === 0) {
    safePool = createDefaultWinnersGallery();
  }

  let previousId = lastPickedWinnerPhotoId;
  if (lastIdOverride !== undefined) {
    previousId = lastIdOverride;
  }

  let candidates = safePool;
  if (safePool.length > 1 && previousId !== null) {
    const filtered = safePool.filter((p) => p.id !== previousId);
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  const index = Math.min(
    candidates.length - 1,
    Math.max(0, Math.floor(randomFn() * candidates.length)),
  );
  const chosen =
    candidates[index] ??
    candidates[0] ??
    (BUILTIN_WINNER_PHOTOS[0] as WinnerPhotoRecord);
  lastPickedWinnerPhotoId = chosen.id;
  return chosen;
}
