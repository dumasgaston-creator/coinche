"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { CheckIcon, TrophyIcon } from "@/components/icons/Icons";
import {
  formatMatchPhaseLabel,
  inspectClientImageMagicBytes,
} from "@/components/admin/admin-demo-data";
import type { AdminTournamentMeta } from "@/components/admin/admin-types";
import {
  BUILTIN_SOUND_PRESETS,
  addCustomSoundClips,
  clearCustomSound,
  getEffectivePresetForSlot,
  playBuiltinSoundPreset,
  playLiveSound,
  readCustomSoundBank,
  readSoundPresetPrefs,
  removeCustomSoundClip,
  saveSoundPresetPref,
  type BuiltinSoundPresetId,
  type CustomSoundBankMap,
  type CustomSoundEntry,
  type LiveSoundSlot,
  type SoundPresetPrefsMap,
} from "@/components/live/sound-engine";
import {
  approveCommunityMeme,
  deleteCommunityMeme,
  setMemeModerationRequired,
} from "@/lib/memes/meme-bank";
import {
  DEFAULT_LATEST_WINNER_PHOTO_URL,
  addWinnerPhotoToGallery,
  readWinnersGallery,
  removeWinnerPhotoFromGallery,
  type WinnerPhotoRecord,
} from "@/lib/memes/winners-gallery";
import { useMemeBankStore } from "@/lib/memes/use-meme-bank";
import type {
  PoolStandingSummary,
  QualificationOutcome,
} from "@/lib/tournament";

interface AdminPosterAndKnockoutPanelProps {
  tournament: AdminTournamentMeta;
  standings: PoolStandingSummary[];
  qualification: QualificationOutcome | null;
  onPosterUpdated: (params: {
    posterUrl: string;
    mimeLabel: string;
    sizeLabel: string;
  }) => void;
  onWinnerPhotoUpdated?: (params: {
    winnerPhotoUrl: string;
    winnerPhotoCaption: string;
  }) => void;
}

const SOUND_SLOTS_META: ReadonlyArray<{ slot: LiveSoundSlot; label: string }> = [
  { slot: "announce", label: "Annonce (Coinche / Capot / Générale)" },
  { slot: "passed", label: "Contrat passé" },
  { slot: "failed", label: "Capri-Seum (Chuté / Éliminé)" },
  { slot: "champion", label: "Champions (Finale 1000)" },
];

function compressFileToPersistentDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture image impossible."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Format image non lisible."));
        return;
      }
      const rawDataUrl = reader.result;
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        const maxSide = 960;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxSide || h > maxSide) {
          if (w >= h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx === null) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function AdminPosterAndKnockoutPanel(
  props: AdminPosterAndKnockoutPanelProps,
) {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  const [winnerCaptionDraft, setWinnerCaptionDraft] = useState<string>(
    props.tournament.winnerPhotoCaption ?? "Vainqueurs de la soirée",
  );
  const [winnerStatus, setWinnerStatus] = useState<string | null>(null);

  const [customSoundBank, setCustomSoundBank] = useState<CustomSoundBankMap>(
    {},
  );
  const [presetPrefs, setPresetPrefs] = useState<SoundPresetPrefsMap>({});
  const [soundNotice, setSoundNotice] = useState<string | null>(null);
  const [winnersGallery, setWinnersGallery] = useState<WinnerPhotoRecord[]>([]);
  const { bank: memeBank } = useMemeBankStore();
  const pendingMemes = memeBank.items.filter((m) => m.status === "pending");

  useEffect(() => {
    setCustomSoundBank(readCustomSoundBank());
    setPresetPrefs(readSoundPresetPrefs());
    setWinnersGallery(readWinnersGallery());
  }, []);

  async function handlePosterFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    setUploadError(null);
    setUploadStatus(null);
    setUploading(true);

    const magicCheck = await inspectClientImageMagicBytes(file);
    if (!magicCheck.valid) {
      setUploadError(magicCheck.reason ?? "Format image refusé.");
      setUploading(false);
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    let persistentPreviewUrl = "/assets/affiche-soiree.jpg";
    try {
      persistentPreviewUrl = await compressFileToPersistentDataUrl(file);
    } catch {
      persistentPreviewUrl = URL.createObjectURL(file);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tournamentId", props.tournament.id);

      const response = await fetch("/api/admin/poster", {
        method: "POST",
        body: formData,
      });

      const data: unknown = await response.json();
      if (
        response.ok &&
        typeof data === "object" &&
        data !== null &&
        "detectedMimeType" in data
      ) {
        const payload = data as {
          publicUrl?: string | null;
          detectedMimeType: string;
        };
        let targetUrl = persistentPreviewUrl;
        if (
          typeof payload.publicUrl === "string" &&
          payload.publicUrl.length > 0
        ) {
          targetUrl = payload.publicUrl;
        }

        props.onPosterUpdated({
          posterUrl: targetUrl,
          mimeLabel: payload.detectedMimeType,
          sizeLabel: `${sizeKb} Ko`,
        });
        setUploadStatus("Affiche diffusée sur l'accueil et /live.");
      } else {
        props.onPosterUpdated({
          posterUrl: persistentPreviewUrl,
          mimeLabel: magicCheck.detectedMime,
          sizeLabel: `${sizeKb} Ko`,
        });
        setUploadStatus("Affiche diffusée en direct.");
      }
    } catch {
      props.onPosterUpdated({
        posterUrl: persistentPreviewUrl,
        mimeLabel: magicCheck.detectedMime,
        sizeLabel: `${sizeKb} Ko`,
      });
      setUploadStatus("Affiche synchronisée.");
    }

    setUploading(false);
  }

  async function handleWinnerPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined || props.onWinnerPhotoUpdated === undefined) {
      return;
    }

    setWinnerStatus(null);
    const magicCheck = await inspectClientImageMagicBytes(file);
    if (!magicCheck.valid) {
      setWinnerStatus(magicCheck.reason ?? "Format image refusé.");
      return;
    }

    try {
      const compressedUrl = await compressFileToPersistentDataUrl(file);
      let caption = "Vainqueurs de la soirée";
      if (winnerCaptionDraft.trim().length > 0) {
        caption = winnerCaptionDraft.trim();
      }
      props.onWinnerPhotoUpdated({
        winnerPhotoUrl: compressedUrl,
        winnerPhotoCaption: caption,
      });
      try {
        const updatedGallery = addWinnerPhotoToGallery({
          imageUrl: compressedUrl,
          caption,
        });
        setWinnersGallery(updatedGallery);
      } catch {
        // Garde la photo live meme si le dossier local est plein
      }
      setWinnerStatus(
        "Photo ajoutée en direct ET enregistrée dans le Dossier Vainqueurs !",
      );
    } catch {
      setWinnerStatus("Impossible de lire cette photo.");
    }
  }

  async function handleSoundFileUpload(
    slot: LiveSoundSlot,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const fileList = event.target.files;
    if (fileList === null || fileList.length === 0) {
      return;
    }
    setSoundNotice(null);

    const files = Array.from(fileList);
    const loadedEntries: CustomSoundEntry[] = [];
    for (const file of files) {
      if (!file.type.startsWith("audio/")) {
        setSoundNotice(
          `Fichier ignoré (${file.name}) : format audio (.mp3, .wav, .ogg) requis.`,
        );
        continue;
      }
      if (file.size > 1_200_000) {
        setSoundNotice(`Extrait "${file.name}" trop lourd (max 1,2 Mo).`);
        continue;
      }
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            resolve(null);
          }
        };
        reader.readAsDataURL(file);
      });
      if (dataUrl !== null) {
        loadedEntries.push({
          fileName: file.name,
          dataUrl,
        });
      }
    }

    if (loadedEntries.length === 0) {
      return;
    }

    try {
      const updated = addCustomSoundClips(slot, loadedEntries);
      setCustomSoundBank(updated);
      setSoundNotice(
        `${loadedEntries.length} son(s) ajouté(s) en rotation aléatoire pour /live.`,
      );
    } catch (err) {
      let msg = "Stockage local saturé.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setSoundNotice(msg);
    }
    event.target.value = "";
  }

  let uploadBtnText = "Changer l'affiche (JPEG/PNG/WebP)";
  if (uploading) {
    uploadBtnText = "Chargement...";
  }

  const currentWinnerPhoto =
    props.tournament.winnerPhotoUrl ?? DEFAULT_LATEST_WINNER_PHOTO_URL;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <section className="admin-panel" aria-labelledby="admin-poster-heading">
        <div className="admin-panel-header">
          <h2 id="admin-poster-heading" className="admin-panel-title">
            Affiche &amp; Photo Vainqueur Live
          </h2>
          <span className="badge badge-amber">Temps réel</span>
        </div>

        <div className="admin-poster-preview-grid">
          <div className="admin-poster-thumb">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={props.tournament.posterUrl}
              alt="Affiche de la soirée"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <strong style={{ fontSize: "12.5px" }}>Affiche soirée</strong>
            <label
              className="btn btn-sm btn-secondary"
              htmlFor="admin-poster-upload-input"
              style={{ cursor: "pointer" }}
            >
              <span>{uploadBtnText}</span>
            </label>
            <input
              id="admin-poster-upload-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePosterFileChange}
              style={{ display: "none" }}
            />
            {uploadStatus !== null && (
              <p
                className="admin-subtitle"
                style={{ color: "var(--status-pass)", fontWeight: 600 }}
              >
                <CheckIcon size={13} /> {uploadStatus}
              </p>
            )}
            {uploadError !== null && (
              <p
                className="admin-subtitle"
                style={{ color: "var(--status-fail)", fontWeight: 600 }}
              >
                {uploadError}
              </p>
            )}
          </div>
        </div>

        {/* Upload en temps réel de la photo des vainqueurs */}
        <div
          style={{
            paddingTop: "12px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div className="admin-poster-preview-grid">
            <div className="admin-poster-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentWinnerPhoto}
                alt="Photo des vainqueurs Coinch'Eirb"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <strong style={{ fontSize: "12.5px" }}>
                Photo des vainqueurs (en direct)
              </strong>
              <input
                type="text"
                className="admin-auth-input"
                placeholder="Ex. Angèle & Kamila · Champions"
                value={winnerCaptionDraft}
                onChange={(e) => setWinnerCaptionDraft(e.target.value)}
              />
              <label
                className="btn btn-sm btn-primary"
                htmlFor="admin-winner-photo-input"
                style={{ cursor: "pointer" }}
              >
                <span>Prendre / Uploader photo vainqueur</span>
              </label>
              <input
                id="admin-winner-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={handleWinnerPhotoChange}
                style={{ display: "none" }}
              />
              {winnerStatus !== null && (
                <p
                  className="admin-subtitle"
                  style={{ color: "var(--status-pass)", fontWeight: 600 }}
                >
                  {winnerStatus}
                </p>
              )}
            </div>
          </div>

          {/* Mini-galerie du Dossier Vainqueurs utilisee en aleatoire pour "Tu y es presque !" */}
          {winnersGallery.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  marginBottom: "6px",
                }}
              >
                <span style={{ fontSize: "11.5px", fontWeight: 700 }}>
                  Dossier Vainqueurs ({winnersGallery.length} photos · tirage
                  aléatoire « Tu y es presque ! »)
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                {winnersGallery.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: "relative",
                      width: "68px",
                      height: "68px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--border-strong)",
                      backgroundColor: "#14100e",
                    }}
                    title={item.caption}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={item.caption}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                    {!item.isBuiltin && (
                      <button
                        type="button"
                        aria-label={`Retirer ${item.caption}`}
                        onClick={() =>
                          setWinnersGallery(
                            removeWinnerPhotoFromGallery(item.id),
                          )
                        }
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "999px",
                          border: "none",
                          backgroundColor: "rgba(200, 52, 43, 0.9)",
                          color: "#fff",
                          fontSize: "11px",
                          fontWeight: 800,
                          cursor: "pointer",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Sons /live : jingles gratuits intégrés + upload MP3/WAV perso */}
      <section className="admin-panel" aria-labelledby="admin-sounds-heading">
        <div className="admin-panel-header">
          <h2 id="admin-sounds-heading" className="admin-panel-title">
            Sons des Pop-ups (/live)
          </h2>
          <span className="badge badge-neutral">Audio intégré + MP3</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {SOUND_SLOTS_META.map((item) => {
            const clips = customSoundBank[item.slot] ?? [];
            const activePreset = getEffectivePresetForSlot(
              item.slot,
              presetPrefs,
            );

            return (
              <div
                key={item.slot}
                className="card-alt"
                style={{
                  padding: "8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
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
                  <div style={{ fontSize: "12.5px", fontWeight: 700 }}>
                    {item.label}
                  </div>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => playLiveSound(item.slot, true)}
                    >
                      Écouter
                    </button>
                    <label
                      className="btn btn-sm btn-secondary"
                      htmlFor={`sound-upload-${item.slot}`}
                      style={{ cursor: "pointer" }}
                    >
                      + MP3
                    </label>
                    <input
                      id={`sound-upload-${item.slot}`}
                      type="file"
                      multiple
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/*"
                      onChange={(e) => {
                        void handleSoundFileUpload(item.slot, e);
                      }}
                      style={{ display: "none" }}
                    />
                    {clips.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost-danger"
                        onClick={() => {
                          clearCustomSound(item.slot);
                          setCustomSoundBank(readCustomSoundBank());
                        }}
                      >
                        Vider
                      </button>
                    )}
                  </div>
                </div>

                {clips.length === 0 && (
                  <select
                    aria-label={`Son brainrot pour ${item.label}`}
                    className="admin-auth-input"
                    value={activePreset}
                    onChange={(e) => {
                      const nextId = e.target.value as BuiltinSoundPresetId;
                      setPresetPrefs(saveSoundPresetPref(item.slot, nextId));
                      playBuiltinSoundPreset(nextId);
                    }}
                  >
                    {BUILTIN_SOUND_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                )}

                {clips.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                    }}
                  >
                    {clips.map((clip) => (
                      <span
                        key={clip.id}
                        className="badge badge-pass"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>{clip.fileName}</span>
                        <button
                          type="button"
                          aria-label={`Retirer ${clip.fileName}`}
                          onClick={() =>
                            setCustomSoundBank(
                              removeCustomSoundClip(item.slot, clip.id),
                            )
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            fontWeight: 700,
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {soundNotice !== null && (
            <p className="admin-subtitle" style={{ fontWeight: 600 }}>
              {soundNotice}
            </p>
          )}
        </div>
      </section>

      {/* Modération de la Boîte à Memes communautaire */}
      <section className="admin-panel" aria-labelledby="admin-memes-heading">
        <div className="admin-panel-header">
          <h2 id="admin-memes-heading" className="admin-panel-title">
            Modération Boîte à Memes ({pendingMemes.length} en attente)
          </h2>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() =>
              setMemeModerationRequired(!memeBank.moderationRequired)
            }
          >
            {memeBank.moderationRequired && "Validation Admin : ON"}
            {!memeBank.moderationRequired && "Publication libre : ON"}
          </button>
        </div>

        {pendingMemes.length === 0 && (
          <p className="admin-panel-subtitle">
            Aucun meme en attente ({memeBank.items.length} memes actifs sur
            /live).
          </p>
        )}

        {pendingMemes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingMemes.map((meme) => (
              <div
                key={meme.id}
                className="card-alt"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={meme.imageUrl}
                    alt={meme.caption}
                    style={{
                      width: "56px",
                      height: "56px",
                      objectFit: "contain",
                      backgroundColor: "#161210",
                      borderRadius: "6px",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>
                      {meme.caption}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                      {meme.category} · par {meme.authorName}
                    </div>
                  </div>
                </div>
                <div style={{ display: "inline-flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-pass"
                    onClick={() => approveCommunityMeme(meme.id)}
                  >
                    Valider
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-danger"
                    onClick={() => deleteCommunityMeme(meme.id)}
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        className="admin-panel"
        aria-labelledby="admin-qualification-heading"
      >
        <div className="admin-panel-header">
          <div className="admin-panel-title-wrap">
            <TrophyIcon size={19} />
            <h2 id="admin-qualification-heading" className="admin-panel-title">
              Qualification &amp; Arbre Final
            </h2>
          </div>

          {props.qualification !== null && (
            <span className="badge badge-terracotta">
              {formatMatchPhaseLabel(props.qualification.format.startingPhase)}
            </span>
          )}
        </div>

        {props.qualification === null && (
          <p className="admin-panel-subtitle">
            Générez les poules pour afficher les qualifiés.
          </p>
        )}

        {props.qualification !== null && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {props.standings.map((pool) => (
                <span
                  key={pool.poolNumber}
                  className="badge badge-neutral tabular-nums"
                >
                  {pool.poolLabel} : {pool.poolTotalPoints} pts
                </span>
              ))}
            </div>

            {props.qualification.wildcardCandidatesRanked.length > 0 && (
              <div
                className="card-alt"
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                <strong
                  style={{ fontSize: "12.5px", textTransform: "uppercase" }}
                >
                  Meilleurs {props.qualification.wildcardRank}es :
                </strong>
                {props.qualification.wildcardCandidatesRanked.map((cand) => {
                  let badgeClass = "badge badge-fail";
                  let statusText = "Éliminé";
                  if (cand.qualified) {
                    badgeClass = "badge badge-pass";
                    statusText = `Qualifié #${cand.bracketSeed}`;
                  }

                  return (
                    <div key={cand.teamId} className="admin-seed-row">
                      <span>
                        <strong>{cand.teamName}</strong> ({cand.poolLabel})
                      </span>
                      <span className="tabular-nums">
                        {cand.matchesWon}V · {cand.pointsScored} pts
                      </span>
                      <span className={badgeClass}>{statusText}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
