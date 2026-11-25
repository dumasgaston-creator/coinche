"use client";

export type LiveSoundSlot =
  | "announce"
  | "passed"
  | "failed"
  | "champion"
  | "first_deal";

export type BuiltinSoundPresetId =
  | "vine_boom"
  | "faaaah"
  | "mlg_airhorn"
  | "sad_trombone"
  | "victory_fanfare"
  | "bruh_drop"
  | "oof_drop"
  | "siren_alert"
  | "sigma_bass"
  | "cartoon_boing";

export interface BuiltinSoundPresetMeta {
  id: BuiltinSoundPresetId;
  label: string;
}

export const BUILTIN_SOUND_PRESETS: readonly BuiltinSoundPresetMeta[] = [
  { id: "vine_boom", label: "Vine Boom (Basse)" },
  { id: "faaaah", label: "FAAAAHHH (Drop viral)" },
  { id: "mlg_airhorn", label: "MLG Airhorn (x3)" },
  { id: "sad_trombone", label: "Trombone Capri-Seum" },
  { id: "bruh_drop", label: "Bruh / Impact" },
  { id: "oof_drop", label: "Oof / Chute sèche" },
  { id: "siren_alert", label: "Sirène Alerte Coinche" },
  { id: "sigma_bass", label: "Sigma Phonk Basse" },
  { id: "cartoon_boing", label: "Boing Cartoon" },
  { id: "victory_fanfare", label: "Fanfare Champions" },
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
const PRESET_PREFS_KEY = "coincheirb-live-sound-presets-v1";

const lastClipIdBySlot: Partial<Record<LiveSoundSlot, string>> = {};

const DEFAULT_SLOT_PRESETS: Record<LiveSoundSlot, BuiltinSoundPresetId> = {
  announce: "vine_boom",
  passed: "mlg_airhorn",
  failed: "faaaah",
  champion: "victory_fanfare",
  first_deal: "mlg_airhorn",
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

/**
 * Joue un effet sonore Brainrot / Meme synthetise gratuitement via Web Audio API.
 */
export function playBuiltinSoundPreset(presetId: BuiltinSoundPresetId): void {
  const ctx = getAudioContext();
  if (ctx === null) {
    return;
  }

  if (presetId === "vine_boom") {
    // Sub-bass Vine Boom percutant (130 Hz -> 34 Hz + harmonique grave)
    scheduleTone(ctx, 135, 0.0, 0.85, "sine", 0.42, 32);
    scheduleTone(ctx, 90, 0.0, 0.55, "triangle", 0.28, 36);
    scheduleTone(ctx, 210, 0.0, 0.12, "sawtooth", 0.14, 52);
    return;
  }

  if (presetId === "faaaah") {
    // Cri / drop viral resonant type "FAAAAHHH" (formant vocal filtre + descente)
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "sawtooth";
    osc1.frequency.setValueAtTime(275, now);
    osc1.frequency.exponentialRampToValueAtTime(340, now + 0.14);
    osc1.frequency.exponentialRampToValueAtTime(145, now + 1.15);

    osc2.frequency.setValueAtTime(278, now);
    osc2.frequency.exponentialRampToValueAtTime(344, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(142, now + 1.15);

    filter.type = "bandpass";
    filter.Q.setValueAtTime(3.2, now);
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(1450, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(520, now + 1.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.04);
    gain.gain.setValueAtTime(0.28, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.25);
    osc2.stop(now + 1.25);
    return;
  }

  if (presetId === "mlg_airhorn") {
    // Triple MLG Airhorn (BWA-BWA-BWAAAAH)
    const hits: ReadonlyArray<[number, number]> = [
      [0.0, 0.16],
      [0.2, 0.16],
      [0.4, 0.65],
    ];
    for (const [offset, dur] of hits) {
      scheduleTone(ctx, 415.3, offset, dur, "sawtooth", 0.15);
      scheduleTone(ctx, 523.25, offset, dur, "sawtooth", 0.13);
      scheduleTone(ctx, 622.25, offset, dur, "square", 0.09);
    }
    return;
  }

  if (presetId === "bruh_drop") {
    // Impact court "Bruh" descendant
    scheduleTone(ctx, 210, 0.0, 0.36, "sawtooth", 0.22, 82);
    scheduleTone(ctx, 110, 0.0, 0.42, "triangle", 0.25, 58);
    return;
  }

  if (presetId === "oof_drop") {
    scheduleTone(ctx, 310, 0.0, 0.14, "square", 0.18, 120);
    scheduleTone(ctx, 180, 0.08, 0.22, "sawtooth", 0.2, 65);
    return;
  }

  if (presetId === "siren_alert") {
    scheduleTone(ctx, 640, 0.0, 0.28, "sawtooth", 0.15, 980);
    scheduleTone(ctx, 980, 0.28, 0.28, "sawtooth", 0.15, 640);
    scheduleTone(ctx, 640, 0.56, 0.28, "sawtooth", 0.15, 980);
    return;
  }

  if (presetId === "sigma_bass") {
    scheduleTone(ctx, 82.4, 0.0, 0.22, "sawtooth", 0.26, 73.4);
    scheduleTone(ctx, 98.0, 0.24, 0.22, "sawtooth", 0.26, 82.4);
    scheduleTone(ctx, 65.4, 0.48, 0.55, "sine", 0.38, 41.2);
    return;
  }

  if (presetId === "cartoon_boing") {
    scheduleTone(ctx, 160, 0.0, 0.18, "sine", 0.26, 540);
    scheduleTone(ctx, 540, 0.18, 0.32, "sine", 0.22, 220);
    return;
  }

  if (presetId === "sad_trombone") {
    // Trombone triste façon "wah-wah-wah-waaaah"
    scheduleTone(ctx, 466.16, 0.0, 0.24, "sawtooth", 0.14);
    scheduleTone(ctx, 440.0, 0.26, 0.24, "sawtooth", 0.14);
    scheduleTone(ctx, 415.3, 0.52, 0.24, "sawtooth", 0.14);
    scheduleTone(ctx, 392.0, 0.78, 0.65, "sawtooth", 0.16, 330.0);
    return;
  }

  // Fanfare Champions
  scheduleTone(ctx, 523.25, 0.0, 0.16, "triangle", 0.2);
  scheduleTone(ctx, 659.25, 0.14, 0.16, "triangle", 0.2);
  scheduleTone(ctx, 783.99, 0.28, 0.16, "triangle", 0.2);
  scheduleTone(ctx, 1046.5, 0.44, 0.75, "triangle", 0.24);
  scheduleTone(ctx, 523.25, 0.44, 0.75, "sine", 0.16);
  scheduleTone(ctx, 783.99, 0.44, 0.75, "sine", 0.16);
}

/**
 * Joue le son associe a un evenement /live :
 * 1) Utilise d'abord le fichier audio perso uploade par l'admin si present
 * 2) Sinon joue le preset Brainrot / Meme choisi (Web Audio API gratuit).
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
        audio.volume = 0.85;
        void audio.play();
        return;
      } catch {
        // Repli vers Web Audio
      }
    }
  }

  const preset = getEffectivePresetForSlot(slot);
  playBuiltinSoundPreset(preset);
}
