"use client";

import { useState, type ChangeEvent } from "react";
import { CheckIcon, TrophyIcon } from "@/components/icons/Icons";
import {
  formatMatchPhaseLabel,
  inspectClientImageMagicBytes,
} from "@/components/admin/admin-demo-data";
import type { AdminTournamentMeta } from "@/components/admin/admin-types";
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
}

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
        resolve(canvas.toDataURL("image/jpeg", 0.86));
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
      setUploadError(
        magicCheck.reason ??
          "Fichier image rejeté par l'inspection des octets magiques.",
      );
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
          sizeLabel: `${sizeKb} Ko (vérifié serveur)`,
        });
        setUploadStatus(
          `Affiche validée par /api/admin/poster (${payload.detectedMimeType}, ${sizeKb} Ko) · Diffusée sur l'accueil et /live.`,
        );
      } else {
        props.onPosterUpdated({
          posterUrl: persistentPreviewUrl,
          mimeLabel: magicCheck.detectedMime,
          sizeLabel: `${sizeKb} Ko (magic bytes OK)`,
        });
        setUploadStatus(
          `Octets magiques ${magicCheck.detectedMime} vérifiés (${sizeKb} Ko) · Diffusée en direct sur l'accueil et /live.`,
        );
      }
    } catch {
      props.onPosterUpdated({
        posterUrl: persistentPreviewUrl,
        mimeLabel: magicCheck.detectedMime,
        sizeLabel: `${sizeKb} Ko (magic bytes OK)`,
      });
      setUploadStatus(
        `Octets magiques ${magicCheck.detectedMime} vérifiés (${sizeKb} Ko) · Synchronisée localement.`,
      );
    }

    setUploading(false);
  }

  let uploadBtnText = "Choisir une affiche (JPEG, PNG, WebP · max 4 Mo)";
  if (uploading) {
    uploadBtnText = "Vérification des magic bytes...";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <section className="admin-panel" aria-labelledby="admin-poster-heading">
        <div className="admin-panel-header">
          <h2 id="admin-poster-heading" className="admin-panel-title">
            Affiche Dynamique de la Soirée
          </h2>
          <span className="badge badge-amber">
            {props.tournament.posterMimeLabel}
          </span>
        </div>

        <p className="admin-panel-subtitle">
          Diffusée sur le héros d&apos;accueil et dans la boucle du
          vidéoprojecteur <strong>/live</strong>. Vérification binaire anti-XSS
          (`validatePosterUpload`).
        </p>

        <div className="admin-poster-preview-grid">
          <div className="admin-poster-thumb">
            <img
              src={props.tournament.posterUrl}
              alt="Aperçu de l'affiche officielle de la soirée Coinch'Eirb"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span className="badge badge-neutral">
              {props.tournament.posterSizeLabel}
            </span>

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
            Pointez au moins 4 équipes au check-in puis cliquez sur « Valider
            check-in &amp; Générer les poules » pour calculer les qualifications.
          </p>
        )}

        {props.qualification !== null && (
          <>
            <p className="admin-panel-subtitle">
              Seuil {props.tournament.roundOf16Threshold} éq. :{" "}
              <strong>
                {props.qualification.qualifiedTeams.length} qualifiées
              </strong>{" "}
              (Top 3 par poule + meilleur 4e au goal-average et force de poule) ·{" "}
              <strong>
                {props.qualification.eliminatedTeams.length} éliminées
              </strong>
              .
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {props.standings.map((pool) => (
                <span
                  key={pool.poolNumber}
                  className="badge badge-neutral tabular-nums"
                >
                  {pool.poolLabel} : {pool.poolTotalPoints} pts cumulés
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
                  Départage des {props.qualification.wildcardRank}es de poule :
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
                        {cand.matchesWon}V · {cand.pointsScored} pts (Poule{" "}
                        {cand.poolTotalPoints})
                      </span>
                      <span className={badgeClass}>{statusText}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="admin-qualif-summary">
              {props.qualification.qualifiedTeams.map((team) => {
                let reasonLabel = "Top 3 poule";
                if (team.qualificationReason === "best_wildcards") {
                  reasonLabel = "Meilleur 4e";
                }

                return (
                  <div key={team.teamId} className="admin-seed-row">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span className="admin-seed-num">#{team.bracketSeed}</span>
                      <span>
                        <strong>{team.teamName}</strong> · {team.poolLabel} (Rang{" "}
                        {team.poolRank})
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="tabular-nums">
                        {team.matchesWon}V · {team.pointsScored} pts
                      </span>
                      <span className="badge badge-amber">{reasonLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
