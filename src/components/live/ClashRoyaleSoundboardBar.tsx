"use client";

import { useEffect, useState } from "react";
import {
  BUILTIN_SOUND_PRESETS,
  playBuiltinSoundPreset,
  readSoundEnabledPreference,
  writeSoundEnabledPreference,
  type BuiltinSoundPresetId,
} from "@/components/live/sound-engine";
import { broadcastSpecialLiveEventFromStore } from "@/lib/tournament/live-store";
import { MegaphoneIcon, ProjectorScreenIcon } from "@/components/icons/Icons";

interface ClashRoyaleSoundboardBarProps {
  compact?: boolean;
  title?: string;
}

const FEATURED_BUTTONS: ReadonlyArray<{
  id: BuiltinSoundPresetId;
  label: string;
  tag: string;
  tone: "win" | "lose" | "hype";
}> = [
  {
    id: "clash_king_laugh",
    label: "Roi HEHEHEHA !",
    tag: "Victoire",
    tone: "win",
  },
  {
    id: "clash_king_hihihiha",
    label: "Roi HIHIHIHA !",
    tag: "Gagné",
    tone: "win",
  },
  {
    id: "faaaah",
    label: "FAAAAHHH !",
    tag: "Perdu / Chuté",
    tone: "lose",
  },
  {
    id: "clash_king_cry",
    label: "Roi qui pleure",
    tag: "UH HUH HUH",
    tone: "lose",
  },
  {
    id: "clash_king_grrr",
    label: "Roi GRRRR !",
    tag: "Vénère",
    tone: "lose",
  },
  {
    id: "emotional_damage",
    label: "Emotional Damage",
    tag: "Surcoinché",
    tone: "lose",
  },
  {
    id: "hog_rider",
    label: "HOG RIDEEEER !",
    tag: "Annonce",
    tone: "hype",
  },
  {
    id: "vine_boom",
    label: "Vine Boom",
    tag: "Coinche ×2",
    tone: "hype",
  },
];

/**
 * Soundboard interactif Clash Royale & Memes (vrais MP3 convertis dans `/assets/sounds/`) :
 * - Joue automatiquement `HEHEHEHA` quand on gagne et `FAAAAHHH` quand on perd / chute
 * - Permet aussi de lancer les sons en 1 clic autour de la table au BAR.
 */
export function ClashRoyaleSoundboardBar(props: ClashRoyaleSoundboardBarProps) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [broadcastToLive, setBroadcastToLive] = useState<boolean>(false);
  const [activeId, setActiveId] = useState<BuiltinSoundPresetId | null>(null);

  useEffect(() => {
    setSoundEnabled(readSoundEnabledPreference());
  }, []);

  function handleToggleAutoSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    writeSoundEnabledPreference(next);
  }

  function handlePlayPreset(
    id: BuiltinSoundPresetId,
    label?: string,
    tone?: "win" | "lose" | "hype",
  ) {
    setActiveId(id);
    if (!soundEnabled) {
      setSoundEnabled(true);
      writeSoundEnabledPreference(true);
    }
    playBuiltinSoundPreset(id);

    if (broadcastToLive) {
      let specialKind: "almost_there" | "elimination" = "almost_there";
      if (tone === "lose") {
        specialKind = "elimination";
      }
      broadcastSpecialLiveEventFromStore({
        specialKind,
        tableNumber: 1,
        teamName: label ?? "Emote Clash Royale",
        opponentName: null,
        pointsAwarded: null,
        customHeadline: label ?? "HEHEHEHA !",
        customBadge: "EMOTE EN DIRECT DU BAR",
        contractNote: "Réaction vocale diffusée depuis une table",
      });
    }

    window.setTimeout(() => {
      setActiveId((prev) => {
        if (prev === id) {
          return null;
        }
        return prev;
      });
    }, 900);
  }

  let heading = "Soundboard Clash Royale & FAAAAHHH (Victoire / Défaite)";
  if (props.title !== undefined) {
    heading = props.title;
  }

  let toggleBadgeClass = "badge badge-pass";
  let toggleText = "Sons auto Victoire/Défaite : ON";
  if (!soundEnabled) {
    toggleBadgeClass = "badge badge-neutral";
    toggleText = "Sons auto : OFF";
  }

  return (
    <section
      className="card"
      aria-label={heading}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MegaphoneIcon size={16} />
          <strong style={{ fontSize: "13.5px" }}>{heading}</strong>
        </div>

        <div style={{ display: "inline-flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="badge badge-amber"
            onClick={() => setBroadcastToLive((prev) => !prev)}
            style={{
              cursor: "pointer",
              border: "1px solid var(--border-strong)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ProjectorScreenIcon size={12} />
            <span>
              {broadcastToLive && "Pop-up /live : ON"}
              {!broadcastToLive && "Pop-up /live : OFF"}
            </span>
          </button>

          <button
            type="button"
            className={toggleBadgeClass}
            onClick={handleToggleAutoSound}
            style={{ cursor: "pointer", border: "1px solid var(--border-strong)" }}
          >
            <span>{toggleText}</span>
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))",
          gap: "6px",
        }}
      >
        {FEATURED_BUTTONS.map((btn) => {
          let borderCol = "var(--border-strong)";
          let tagColor = "var(--ink-muted)";
          if (btn.tone === "win") {
            borderCol = "var(--status-pass)";
            tagColor = "var(--status-pass)";
          } else if (btn.tone === "lose") {
            borderCol = "var(--status-fail)";
            tagColor = "var(--status-fail)";
          } else {
            borderCol = "var(--accent-amber)";
            tagColor = "var(--accent-terracotta)";
          }

          let bgCol = "var(--bg-surface-alt)";
          if (activeId === btn.id) {
            bgCol = "var(--bg-surface)";
          }

          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => handlePlayPreset(btn.id, btn.label, btn.tone)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                gap: "2px",
                padding: "8px 10px",
                borderRadius: "6px",
                border: `1.5px solid ${borderCol}`,
                backgroundColor: bgCol,
                color: "var(--ink-primary)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                className="font-display"
                style={{
                  fontSize: "15px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  lineHeight: 1.1,
                }}
              >
                {btn.label}
              </span>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  color: tagColor,
                  textTransform: "uppercase",
                }}
              >
                {btn.tag}
              </span>
            </button>
          );
        })}
      </div>

      {props.compact !== true && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            alignItems: "center",
            paddingTop: "4px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              color: "var(--ink-secondary)",
            }}
          >
            Autres sons :
          </span>
          {BUILTIN_SOUND_PRESETS.filter(
            (p) => !FEATURED_BUTTONS.some((f) => f.id === p.id),
          ).map((extra) => (
            <button
              key={extra.id}
              type="button"
              className="chip-btn"
              onClick={() => handlePlayPreset(extra.id)}
            >
              {extra.shortLabel}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
