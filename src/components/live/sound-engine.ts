"use client";

export type LiveSoundSlot =
  | "announce"
  | "passed"
  | "failed"
  | "champion"
  | "first_deal";

export type BuiltinSoundPresetId =
  | "clash_king_laugh"
  | "clash_king_hihihiha"
  | "clash_king_cry"
  | "clash_king_grrr"
  | "faaaah"
  | "auughhh"
  | "emotional_damage"
  | "hog_rider"
  | "vine_boom"
  | "mlg_airhorn"
  | "sad_trombone"
  | "bruh_drop"
  | "siren_alert"
  | "club_premiere_donne"
  | "victory_fanfare"
  | "oof_drop"
  | "sigma_bass"
  | "cartoon_boing";

export interface BuiltinSoundPresetMeta {
  id: BuiltinSoundPresetId;
  label: string;
  shortLabel: string;
  category: "win" | "lose" | "hype";
  audioUrl: string | null;
}

/**
 * Banque de sons reelle Coinch'Eirb :
 * - Vrais fichiers audio MP3/M4A dans `/assets/sounds/` (convertis depuis vraies videos & voix Clash Royale)
 * - Roi Clash Royale qui rigole (HEHEHEHA / HIHIHIHA) quand on gagne
 * - Vrai cri FAAAAHHH / Roi qui pleure / Emotional Damage quand on perd ou chute.
 */
export const BUILTIN_SOUND_PRESETS: readonly BuiltinSoundPresetMeta[] = [
  {
    id: "clash_king_laugh",
    label: "Roi Clash Royale qui rigole (HEHEHEHA !)",
    shortLabel: "Roi HEHEHEHA",
    category: "win",
    audioUrl: "/assets/sounds/clash-king-laugh.mp3",
  },
  {
    id: "clash_king_hihihiha",
    label: "Roi Clash Royale Victoire (HIHIHIHA !)",
    shortLabel: "Roi HIHIHIHA",
    category: "win",
    audioUrl: "/assets/sounds/clash-king-thumbsup.mp3",
  },
  {
    id: "faaaah",
    label: "Vrai FAAAAHHH (Vidéo quand on perd / chute)",
    shortLabel: "FAAAAHHH !",
    category: "lose",
    audioUrl: "/assets/sounds/faaaah-lose.mp3",
  },
  {
    id: "clash_king_cry",
    label: "Roi Clash Royale qui pleure (UH HUH HUH)",
    shortLabel: "Roi qui pleure",
    category: "lose",
    audioUrl: "/assets/sounds/clash-king-cry.mp3",
  },
  {
    id: "clash_king_grrr",
    label: "Roi Clash Royale vénère (GRRRR !)",
    shortLabel: "Roi GRRRR",
    category: "lose",
    audioUrl: "/assets/sounds/clash-king-grrr.mp3",
  },
  {
    id: "emotional_damage",
    label: "EMOTIONAL DAMAGE (Chute / Contre)",
    shortLabel: "Emotional Damage",
    category: "lose",
    audioUrl: "/assets/sounds/emotional-damage.mp3",
  },
  {
    id: "auughhh",
    label: "AUUGHHH (Désespoir total)",
    shortLabel: "AUUGHHH",
    category: "lose",
    audioUrl: "/assets/sounds/auughhh-lose.mp3",
  },
  {
    id: "hog_rider",
    label: "Clash Royale HOG RIDEEEER ! (Annonce)",
    shortLabel: "HOG RIDER !",
    category: "hype",
    audioUrl: "/assets/sounds/hog-rider.mp3",
  },
  {
    id: "vine_boom",
    label: "Vrai Vine Boom (Impact Coinche)",
    shortLabel: "Vine Boom",
    category: "hype",
    audioUrl: "/assets/sounds/vine-boom.mp3",
  },
  {
    id: "siren_alert",
    label: "Sirène Alerte Générale / Surcoinche",
    shortLabel: "Sirène Coinche",
    category: "hype",
    audioUrl: "/assets/sounds/siren-coinche.mp3",
  },
  {
    id: "mlg_airhorn",
    label: "MLG Airhorn (Capot / Finale)",
    shortLabel: "MLG Airhorn",
    category: "win",
    audioUrl: "/assets/sounds/mlg-airhorn.mp3",
  },
  {
    id: "sad_trombone",
    label: "Trombone Capri-Seum (Élimination)",
    shortLabel: "Trombone Seum",
    category: "lose",
    audioUrl: "/assets/sounds/sad-trombone.mp3",
  },
  {
    id: "bruh_drop",
    label: "BRUH (Parlante 160 pts)",
    shortLabel: "BRUH",
    category: "lose",
    audioUrl: "/assets/sounds/bruh.mp3",
  },
  {
    id: "club_premiere_donne",
    label: "Audio Vidéo Première Donne (BAR ENSEIRB)",
    shortLabel: "1re Donne BAR",
    category: "hype",
    audioUrl: "/assets/sounds/club-premiere-donne.m4a",
  },
];

export interface CustomSoundEntry {
  id?: string;
  fileName: string;
  dataUrl: string;
}

export interface CustomSoundClip {
  id: string;
  fileName: string;
  dataUrl: string;
}

export type CustomSoundsMap = Partial<Record<LiveSoundSlot, CustomSoundEntry>>;
export type CustomSoundBankMap = Partial<
  Record<LiveSoundSlot, CustomSoundClip[]>
>;
export type SoundPresetPrefsMap = Partial<
  Record<LiveSoundSlot, BuiltinSoundPresetId>
>;

const SOUND_ENABLED_KEY = "coincheirb-live-sound-enabled";
const CUSTOM_SOUNDS_KEY = "coincheirb-live-custom-sounds-v1";
const PRESET_PREFS_KEY = "coincheirb-live-sound-presets-v2";

const lastClipIdBySlot: Partial<Record<LiveSoundSlot, string>> = {};

const DEFAULT_SLOT_PRESETS: Record<LiveSoundSlot, BuiltinSoundPresetId> = {
  announce: "hog_rider",
  passed: "clash_king_laugh",
  failed: "faaaah",
  champion: "clash_king_hihihiha",
  first_deal: "club_premiere_donne",
};

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

/**
 * Son active par defaut (`true`) pour que les voix Clash Royale et le cri FAAAAHHH
 * fonctionnent immediatement en partie et sur /live (desactivable en 1 clic).
 */
export function readSoundEnabledPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  try {
    const stored = window.localStorage.getItem(SOUND_ENABLED_KEY);
    if (stored === null) {
      return true;
    }
    return stored === "true";
  } catch {
    return true;
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

function normalizeSoundClips(rawValue: unknown): CustomSoundClip[] {
  if (Array.isArray(rawValue)) {
    const out: CustomSoundClip[] = [];
    for (let i = 0; i < rawValue.length; i += 1) {
      const item = rawValue[i];
      if (typeof item === "object" && item !== null) {
        const record = item as Partial<CustomSoundClip>;
        if (
          typeof record.fileName === "string" &&
          typeof record.dataUrl === "string" &&
          record.dataUrl.length > 0
        ) {
          let clipId = `clip-${i}-${record.fileName}`;
          if (typeof record.id === "string" && record.id.length > 0) {
            clipId = record.id;
          }
          out.push({
            id: clipId,
            fileName: record.fileName,
            dataUrl: record.dataUrl,
          });
        }
      }
    }
    return out;
  }

  if (typeof rawValue === "object" && rawValue !== null) {
    const single = rawValue as Partial<CustomSoundEntry>;
    if (
      typeof single.fileName === "string" &&
      typeof single.dataUrl === "string" &&
      single.dataUrl.length > 0
    ) {
      let clipId = `legacy-${single.fileName}`;
      if (typeof single.id === "string" && single.id.length > 0) {
        clipId = single.id;
      }
      return [
        {
          id: clipId,
          fileName: single.fileName,
          dataUrl: single.dataUrl,
        },
      ];
    }
  }

  return [];
}

export function readCustomSoundBank(): CustomSoundBankMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_SOUNDS_KEY);
    if (raw === null || raw.length === 0) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    const bank: CustomSoundBankMap = {};
    const slots: LiveSoundSlot[] = [
      "announce",
      "passed",
      "failed",
      "champion",
      "first_deal",
    ];
    for (const slot of slots) {
      const clips = normalizeSoundClips(record[slot]);
      if (clips.length > 0) {
        bank[slot] = clips;
      }
    }
    return bank;
  } catch {
    return {};
  }
}

export function readCustomSounds(): CustomSoundsMap {
  const bank = readCustomSoundBank();
  const legacy: CustomSoundsMap = {};
  const slots: LiveSoundSlot[] = [
    "announce",
    "passed",
    "failed",
    "champion",
    "first_deal",
  ];
  for (const slot of slots) {
    const list = bank[slot];
    if (list !== undefined && list.length > 0) {
      legacy[slot] = list[0];
    }
  }
  return legacy;
}

function writeCustomSoundBank(bank: CustomSoundBankMap): CustomSoundBankMap {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(bank));
    } catch {
      throw new Error(
        "Banque audio trop lourde pour le stockage local (visez des extraits courts < 1 Mo).",
      );
    }
  }
  return bank;
}

export function addCustomSoundClips(
  slot: LiveSoundSlot,
  entries: CustomSoundEntry[],
): CustomSoundBankMap {
  const current = readCustomSoundBank();
  const existing = current[slot] ?? [];
  const appended: CustomSoundClip[] = [...existing];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined) {
      continue;
    }
    let clipId = `clip-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
    if (typeof entry.id === "string" && entry.id.length > 0) {
      clipId = entry.id;
    }
    appended.push({
      id: clipId,
      fileName: entry.fileName,
      dataUrl: entry.dataUrl,
    });
  }
  const next: CustomSoundBankMap = {
    ...current,
    [slot]: appended,
  };
  return writeCustomSoundBank(next);
}

export function removeCustomSoundClip(
  slot: LiveSoundSlot,
  clipId: string,
): CustomSoundBankMap {
  const current = readCustomSoundBank();
  const existing = current[slot] ?? [];
  const remaining = existing.filter((clip) => clip.id !== clipId);
  const next: CustomSoundBankMap = { ...current };
  if (remaining.length > 0) {
    next[slot] = remaining;
  } else {
    delete next[slot];
  }
  return writeCustomSoundBank(next);
}

export function readSoundPresetPrefs(): SoundPresetPrefsMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PRESET_PREFS_KEY);
    if (raw === null || raw.length === 0) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as SoundPresetPrefsMap;
    }
  } catch {
    // Ignore
  }
  return {};
}

export function saveSoundPresetPref(
  slot: LiveSoundSlot,
  presetId: BuiltinSoundPresetId,
): SoundPresetPrefsMap {
  const next: SoundPresetPrefsMap = {
    ...readSoundPresetPrefs(),
    [slot]: presetId,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PRESET_PREFS_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  }
  return next;
}

export function getEffectivePresetForSlot(
  slot: LiveSoundSlot,
  prefs?: SoundPresetPrefsMap,
): BuiltinSoundPresetId {
  const map = prefs ?? readSoundPresetPrefs();
  const chosen = map[slot];
  if (chosen !== undefined) {
    return chosen;
  }
  return DEFAULT_SLOT_PRESETS[slot];
}

export function saveCustomSound(
  slot: LiveSoundSlot,
  entry: CustomSoundEntry,
): CustomSoundsMap {
  addCustomSoundClips(slot, [entry]);
  return readCustomSounds();
}

export function clearCustomSound(slot: LiveSoundSlot): CustomSoundsMap {
  const current = readCustomSoundBank();
  const next: CustomSoundBankMap = { ...current };
  delete next[slot];
  writeCustomSoundBank(next);
  return readCustomSounds();
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
      Math.max(28, slideToFreq),
      now + durationSec,
    );
  }
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + durationSec + 0.04);
}

function playFallbackWebAudioTone(presetId: BuiltinSoundPresetId): void {
  const ctx = getAudioContext();
  if (ctx === null) {
    return;
  }
  if (
    presetId === "faaaah" ||
    presetId === "auughhh" ||
    presetId === "clash_king_cry" ||
    presetId === "clash_king_grrr" ||
    presetId === "emotional_damage" ||
    presetId === "sad_trombone"
  ) {
    scheduleTone(ctx, 320, 0.0, 0.9, "sawtooth", 0.25, 130);
    return;
  }
  scheduleTone(ctx, 523.25, 0.0, 0.16, "triangle", 0.2);
  scheduleTone(ctx, 659.25, 0.14, 0.16, "triangle", 0.2);
  scheduleTone(ctx, 783.99, 0.28, 0.45, "triangle", 0.24);
}

/**
 * Joue un vrai fichier audio MP3/M4A de la banque (`/assets/sounds/...`)
 * avec repli Web Audio API si l'environnement ne supporte pas `HTMLAudioElement`.
 */
export function playBuiltinSoundPreset(presetId: BuiltinSoundPresetId): void {
  if (typeof window === "undefined") {
    return;
  }

  let foundMeta: BuiltinSoundPresetMeta | null = null;
  for (const item of BUILTIN_SOUND_PRESETS) {
    if (item.id === presetId) {
      foundMeta = item;
      break;
    }
  }

  const audioUrl = foundMeta?.audioUrl ?? "/assets/sounds/clash-king-laugh.mp3";
  if (typeof Audio !== "undefined" && audioUrl !== null) {
    try {
      const audio = new Audio(audioUrl);
      audio.volume = 0.9;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          playFallbackWebAudioTone(presetId);
        });
      }
      return;
    } catch {
      playFallbackWebAudioTone(presetId);
      return;
    }
  }

  playFallbackWebAudioTone(presetId);
}

/**
 * Declenche instantanement l'effet sonore adapte lors d'une victoire (Roi Clash Royale qui rigole)
 * ou d'une defaite / chute (vrai cri FAAAAHHH !).
 */
export function playMatchOutcomeSound(
  outcome: "win" | "lose" | "cry" | "grrr" | "hog_rider",
): void {
  if (!readSoundEnabledPreference()) {
    return;
  }
  if (outcome === "win") {
    playBuiltinSoundPreset("clash_king_laugh");
    return;
  }
  if (outcome === "lose") {
    playBuiltinSoundPreset("faaaah");
    return;
  }
  if (outcome === "cry") {
    playBuiltinSoundPreset("clash_king_cry");
    return;
  }
  if (outcome === "grrr") {
    playBuiltinSoundPreset("clash_king_grrr");
    return;
  }
  playBuiltinSoundPreset("hog_rider");
}

/**
 * Joue le son associe a un evenement /live ou table :
 * 1) Utilise d'abord le fichier audio perso uploade par l'admin si present
 * 2) Sinon joue le vrai fichier audio MP3/M4A du preset choisi (Clash Royale / FAAAAHHH / Video BAR).
 */
export function playLiveSound(
  slot: LiveSoundSlot,
  forcePlay: boolean = false,
): void {
  if (!forcePlay && !readSoundEnabledPreference()) {
    return;
  }

  const bank = readCustomSoundBank();
  const clips = bank[slot];
  if (clips !== undefined && clips.length > 0) {
    let chosen = clips[0];
    if (clips.length > 1) {
      const previousId = lastClipIdBySlot[slot];
      const eligible = clips.filter((c) => c.id !== previousId);
      let pool = clips;
      if (eligible.length > 0) {
        pool = eligible;
      }
      const picked = pool[Math.floor(Math.random() * pool.length)];
      if (picked !== undefined) {
        chosen = picked;
      }
    }
    if (chosen !== undefined && chosen.dataUrl.length > 0) {
      lastClipIdBySlot[slot] = chosen.id;
      try {
        const audio = new Audio(chosen.dataUrl);
        audio.volume = 0.9;
        void audio.play();
        return;
      } catch {
        // Repli vers la banque MP3 integree
      }
    }
  }

  const preset = getEffectivePresetForSlot(slot);
  playBuiltinSoundPreset(preset);
}
