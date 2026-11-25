"use client";

export type LiveSoundSlot =
  | "announce"
  | "passed"
  | "failed"
  | "champion"
  | "first_deal";

export interface CustomSoundEntry {
  fileName: string;
  dataUrl: string;
}

export type CustomSoundsMap = Partial<Record<LiveSoundSlot, CustomSoundEntry>>;

const SOUND_ENABLED_KEY = "coincheirb-live-sound-enabled";
const CUSTOM_SOUNDS_KEY = "coincheirb-live-custom-sounds-v1";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (Ctor === undefined) {
    return null;
  }
  if (sharedAudioCtx === null) {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
}

export function readSoundEnabledPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(SOUND_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSoundEnabledPreference(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  } catch {
    // Ignore
  }
  if (enabled) {
    getAudioContext();
  }
}

export function readCustomSounds(): CustomSoundsMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_SOUNDS_KEY);
    if (raw === null || raw.length === 0) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as CustomSoundsMap;
    }
  } catch {
    // Ignore
  }
  return {};
}

export function saveCustomSound(
  slot: LiveSoundSlot,
  entry: CustomSoundEntry,
): CustomSoundsMap {
  const current = readCustomSounds();
  const next: CustomSoundsMap = {
    ...current,
    [slot]: entry,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(next));
    } catch {
      throw new Error(
        "Fichier audio trop lourd pour le stockage local (visez un extrait < 1 Mo).",
      );
    }
  }
  return next;
}

export function clearCustomSound(slot: LiveSoundSlot): CustomSoundsMap {
  const current = readCustomSounds();
  const next: CustomSoundsMap = { ...current };
  delete next[slot];
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  }
  return next;
}

function scheduleTone(
  ctx: AudioContext,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  slideToFreq?: number,
): void {
  const now = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideToFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, slideToFreq),
      now + durationSec,
    );
  }
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.03);
}

/**
 * Joue le son associe a un evenement /live :
 * 1) Utilise d'abord le fichier audio perso uploade par l'admin si present
 * 2) Sinon joue un jingle synthetise gratuit (Web Audio API) sans aucune dependance externe.
 */
export function playLiveSound(slot: LiveSoundSlot, forcePlay: boolean = false): void {
  if (!forcePlay && !readSoundEnabledPreference()) {
    return;
  }

  const customSounds = readCustomSounds();
  const custom = customSounds[slot];
  if (custom !== undefined && custom.dataUrl.length > 0) {
    try {
      const audio = new Audio(custom.dataUrl);
      audio.volume = 0.85;
      void audio.play();
      return;
    } catch {
      // Repli vers Web Audio
    }
  }

  const ctx = getAudioContext();
  if (ctx === null) {
    return;
  }

  if (slot === "failed") {
    // Trombone triste façon "wah-wah-wah-waaaah" pour Capri-Seum / éliminé / chuté
    scheduleTone(ctx, 466.16, 0.0, 0.24, "sawtooth", 0.14);
    scheduleTone(ctx, 440.0, 0.26, 0.24, "sawtooth", 0.14);
    scheduleTone(ctx, 415.3, 0.52, 0.24, "sawtooth", 0.14);
    scheduleTone(ctx, 392.0, 0.78, 0.65, "sawtooth", 0.16, 330.0);
    return;
  }

  if (slot === "passed") {
    // Fanfare majeure montante
    scheduleTone(ctx, 523.25, 0.0, 0.14, "triangle", 0.18);
    scheduleTone(ctx, 659.25, 0.12, 0.14, "triangle", 0.18);
    scheduleTone(ctx, 783.99, 0.24, 0.18, "triangle", 0.2);
    scheduleTone(ctx, 1046.5, 0.4, 0.45, "triangle", 0.22);
    return;
  }

  if (slot === "champion") {
    // Accord de victoire finale
    scheduleTone(ctx, 523.25, 0.0, 0.16, "triangle", 0.2);
    scheduleTone(ctx, 659.25, 0.14, 0.16, "triangle", 0.2);
    scheduleTone(ctx, 783.99, 0.28, 0.16, "triangle", 0.2);
    scheduleTone(ctx, 1046.5, 0.44, 0.7, "triangle", 0.24);
    scheduleTone(ctx, 523.25, 0.44, 0.7, "sine", 0.16);
    scheduleTone(ctx, 783.99, 0.44, 0.7, "sine", 0.16);
    return;
  }

  if (slot === "first_deal") {
    // Gong d'ouverture de soirée
    scheduleTone(ctx, 392.0, 0.0, 0.18, "triangle", 0.2);
    scheduleTone(ctx, 587.33, 0.16, 0.5, "triangle", 0.22);
    return;
  }

  // Annonce (Capot / Générale / Coinche / Surcoinche) : double stinger énergique
  scheduleTone(ctx, 440.0, 0.0, 0.12, "triangle", 0.2);
  scheduleTone(ctx, 587.33, 0.13, 0.28, "triangle", 0.22);
}
