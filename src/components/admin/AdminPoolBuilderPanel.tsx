"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons/Icons";
import {
  computeOptimalPoolSizes,
  formatPoolLabel,
  generatePoolsAndSchedule,
  type GeneratedPool,
  type PoolDrawMode,
  type TournamentTeamInput,
} from "@/lib/tournament";
import {
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
} from "@/lib/tournament/live-store";

interface AdminPoolBuilderPanelProps {
  teams: TournamentTeamInput[];
  pools: GeneratedPool[];
  hasScoredPoolMatches: boolean;
  onApplyManualPools: (poolTeamIds: string[][], summaryLabel: string) => void;
}

/**
 * Atelier Poules Administrateur :
 * 1. Choisir des Tetes de serie (TDS) en 1 clic (placees dans des poules differentes)
 * 2. Tirer au sort (TDS + Aleatoire, 100 % Aleatoire, ou Auto equilibre)
 * 3. Ajuster librement les poules a la main (echanger 2 equipes ou deplacer vers une autre poule)
 *    puis appliquer en 1 clic pour regenerer automatiquement tous les matchs et tables.
 */
export function AdminPoolBuilderPanel(props: AdminPoolBuilderPanelProps) {
  const activeTeams = useMemo(
    () => props.teams.filter((t) => t.checkedIn && !t.isForfeit),
    [props.teams],
  );

  const teamById = useMemo(() => {
    const map = new Map<string, TournamentTeamInput>();
    for (const t of activeTeams) {
      map.set(t.id, t);
    }
    return map;
  }, [activeTeams]);

  const optimalPoolCount = useMemo(() => {
    if (activeTeams.length < 4) {
      return 1;
    }
    return computeOptimalPoolSizes(activeTeams.length).length;
  }, [activeTeams.length]);

  const [seededIds, setSeededIds] = useState<string[]>([]);
  const [draftPools, setDraftPools] = useState<string[][]>([]);
  const [swapSource, setSwapSource] = useState<{
    poolIdx: number;
    teamId: string;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Synchronise le brouillon avec les poules actuelles du tournoi tant qu'il n'y a pas d'edition locale non sauvegardee
  useEffect(() => {
    if (hasUnsavedChanges) {
      return;
    }
    if (props.pools.length > 0) {
      const fromExisting = props.pools.map((p) =>
        p.teams.map((member) => member.teamId),
      );
      setDraftPools(fromExisting);
    } else if (activeTeams.length >= 4) {
      const initialPlan = generatePoolsAndSchedule(activeTeams, {
        mode: "deterministic",
      });
      setDraftPools(
        initialPlan.pools.map((p) => p.teams.map((m) => m.teamId)),
      );
    } else {
      setDraftPools([]);
    }
  }, [props.pools, activeTeams, hasUnsavedChanges]);

  function toggleSeededTeam(teamId: string) {
    setLocalError(null);
    setSeededIds((prev) => {
      if (prev.includes(teamId)) {
        return prev.filter((id) => id !== teamId);
      }
      return [...prev, teamId];
    });
  }

  function runPreviewDraw(mode: PoolDrawMode) {
    setLocalError(null);
    setSwapSource(null);
    if (activeTeams.length < 4) {
      setLocalError("Il faut au moins 4 équipes pointées au check-in.");
      return;
    }
    const plan = generatePoolsAndSchedule(activeTeams, {
      mode,
      seededTeamIds: seededIds,
    });
    setDraftPools(plan.pools.map((p) => p.teams.map((m) => m.teamId)));
    setHasUnsavedChanges(true);
  }

  function handleMoveTeamToPool(
    fromPoolIdx: number,
    teamId: string,
    toPoolIdx: number,
  ) {
    if (fromPoolIdx === toPoolIdx) {
      return;
    }
    setLocalError(null);
    setSwapSource(null);
    setDraftPools((prev) => {
      const next = prev.map((pool) => [...pool]);
      const sourcePool = next[fromPoolIdx];
      const targetPool = next[toPoolIdx];
      if (sourcePool === undefined || targetPool === undefined) {
        return prev;
      }
      const idx = sourcePool.indexOf(teamId);
      if (idx === -1) {
        return prev;
      }
      sourcePool.splice(idx, 1);
      targetPool.push(teamId);
      return next;
    });
    setHasUnsavedChanges(true);
  }

  function handleSwapClick(poolIdx: number, teamId: string) {
    setLocalError(null);
    if (swapSource === null) {
      setSwapSource({ poolIdx, teamId });
      return;
    }
    if (swapSource.teamId === teamId) {
      setSwapSource(null);
      return;
    }

    const src = swapSource;
    setDraftPools((prev) => {
      const next = prev.map((pool) => [...pool]);
      const poolA = next[src.poolIdx];
      const poolB = next[poolIdx];
      if (poolA === undefined || poolB === undefined) {
        return prev;
      }
      const idxA = poolA.indexOf(src.teamId);
      const idxB = poolB.indexOf(teamId);
      if (idxA === -1 || idxB === -1) {
        return prev;
      }
      poolA[idxA] = teamId;
      poolB[idxB] = src.teamId;
      return next;
    });
    setSwapSource(null);
    setHasUnsavedChanges(true);
  }

  function handleApplyDraft() {
    setLocalError(null);
    const nonEmpty = draftPools.filter((p) => p.length > 0);
    if (nonEmpty.length === 0) {
      setLocalError("Aucune poule à valider.");
      return;
    }
    for (let i = 0; i < nonEmpty.length; i += 1) {
      const size = nonEmpty[i]?.length ?? 0;
      if (size < 2) {
        setLocalError(
          `${formatPoolLabel(i + 1)} ne contient qu'une seule équipe (minimum 2 par poule).`,
        );
        return;
      }
    }

    setHasUnsavedChanges(false);
    setSwapSource(null);
    props.onApplyManualPools(
      nonEmpty,
      `${nonEmpty.length} poules personnalisées (${seededIds.length} tête(s) de série)`,
    );
  }

  return (
    <section
      className="admin-panel"
      aria-labelledby="admin-pool-builder-heading"
    >
      <div className="admin-panel-header">
        <div className="admin-panel-title-wrap">
          <TrophyIcon size={18} />
          <h2 id="admin-pool-builder-heading" className="admin-panel-title">
            Atelier Poules · Têtes de série &amp; Manuel
          </h2>
        </div>
        <span className="badge badge-amber tabular-nums">
          {seededIds.length} / {optimalPoolCount} TDS
        </span>
      </div>

      {/* 1. Sélection rapide des Têtes de série */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: 700 }}>
            1. Clique sur tes Têtes de série (séparées dans des poules
            différentes) :
          </span>
          {seededIds.length > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              style={{ minHeight: "28px", fontSize: "11.5px" }}
              onClick={() => setSeededIds([])}
            >
              Vider TDS
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {activeTeams.map((team) => {
            const seedPos = seededIds.indexOf(team.id);
            const isSeeded = seedPos !== -1;
            const label = formatPlayersPrimaryName(
              team.player1Name,
              team.player2Name,
            );
            let pillClass = "badge badge-neutral";
            if (isSeeded) {
              pillClass = "badge badge-amber";
            }
            return (
              <button
                key={team.id}
                type="button"
                className={pillClass}
                style={{ cursor: "pointer", padding: "5px 9px" }}
                onClick={() => toggleSeededTeam(team.id)}
              >
                {isSeeded && <span>★ #{seedPos + 1}</span>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Boutons de tirage */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          paddingTop: "8px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={activeTeams.length < 4}
          onClick={() => runPreviewDraw("seeded_random")}
        >
          <span>Tirage TDS + Aléatoire</span>
        </button>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={activeTeams.length < 4}
          onClick={() => runPreviewDraw("random")}
        >
          <span>Tirage 100 % Aléatoire</span>
        </button>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={activeTeams.length < 4}
          onClick={() => runPreviewDraw("deterministic")}
        >
          <span>Auto équilibré</span>
        </button>
      </div>

      {/* 3. Grille d'édition manuelle libre des poules */}
      {draftPools.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            paddingTop: "8px",
            borderTop: "1px solid var(--border-subtle)",
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
            <span style={{ fontSize: "12px", fontWeight: 700 }}>
              2. Ajuste les poules à ta guise (Échanger ou Déplacer) :
            </span>
            {swapSource !== null && (
              <span className="badge badge-terracotta">
                Clique sur une autre équipe pour échanger (ou annule)
              </span>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "10px",
            }}
          >
            {draftPools.map((poolTeamIds, poolIdx) => {
              const poolName = formatPoolLabel(poolIdx + 1);
              return (
                <div
                  key={poolName}
                  className="card-alt"
                  style={{
                    padding: "10px",
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
                      gap: "6px",
                      paddingBottom: "6px",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <strong
                      className="font-display"
                      style={{ fontSize: "17px", textTransform: "uppercase" }}
                    >
                      {poolName}
                    </strong>
                    <span className="badge badge-neutral tabular-nums">
                      <UsersIcon size={11} />
                      <span>{poolTeamIds.length}</span>
                    </span>
                  </div>

                  {poolTeamIds.map((teamId) => {
                    const team = teamById.get(teamId);
                    if (team === undefined) {
                      return null;
                    }
                    const playersLabel = formatPlayersPrimaryName(
                      team.player1Name,
                      team.player2Name,
                    );
                    const nickname = formatOptionalTeamNickname(
                      team.teamName,
                      team.player1Name,
                      team.player2Name,
                    );
                    const isSeeded = seededIds.includes(team.id);
                    const isSwapSelected =
                      swapSource !== null && swapSource.teamId === team.id;

                    let rowBorder = "1px solid var(--border-subtle)";
                    if (isSwapSelected) {
                      rowBorder = "2px solid var(--accent-terracotta)";
                    } else if (isSeeded) {
                      rowBorder = "1.5px solid var(--accent-amber)";
                    }

                    let swapBtnLabel = "Échanger";
                    if (isSwapSelected) {
                      swapBtnLabel = "Annuler";
                    } else if (swapSource !== null) {
                      swapBtnLabel = "Ici !";
                    }

                    return (
                      <div
                        key={team.id}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "4px",
                          border: rowBorder,
                          backgroundColor: "var(--bg-surface)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "6px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 700,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {isSeeded && "★ "}
                              {playersLabel}
                            </div>
                            {nickname !== null && (
                              <div
                                style={{
                                  fontSize: "10.5px",
                                  color: "var(--ink-muted)",
                                }}
                              >
                                « {nickname} »
                              </div>
                            )}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            style={{
                              minHeight: "26px",
                              padding: "0 8px",
                              fontSize: "11px",
                            }}
                            onClick={() => handleSwapClick(poolIdx, team.id)}
                          >
                            {swapBtnLabel}
                          </button>

                          <select
                            aria-label={`Déplacer ${playersLabel} vers une autre poule`}
                            value={poolIdx}
                            onChange={(e) => {
                              const destIdx = Number.parseInt(
                                e.target.value,
                                10,
                              );
                              if (!Number.isNaN(destIdx)) {
                                handleMoveTeamToPool(poolIdx, team.id, destIdx);
                              }
                            }}
                            style={{
                              flex: 1,
                              minHeight: "26px",
                              fontSize: "11px",
                              borderRadius: "4px",
                              border: "1px solid var(--border-strong)",
                              backgroundColor: "var(--bg-surface-alt)",
                              color: "var(--ink-primary)",
                              padding: "0 4px",
                            }}
                          >
                            {draftPools.map((_, targetIdx) => (
                              <option key={targetIdx} value={targetIdx}>
                                {formatPoolLabel(targetIdx + 1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {localError !== null && (
            <div className="banner banner-fail" role="alert">
              {localError}
            </div>
          )}

          {hasUnsavedChanges && props.hasScoredPoolMatches && (
            <div className="banner banner-info">
              <span>
                Attention : valider ces nouvelles poules recréera les matchs de
                poules à 0 pt (les matchs en cours seront remplacés).
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-sm btn-pass"
              onClick={handleApplyDraft}
            >
              <CheckIcon size={15} />
              <span>Appliquer ces poules &amp; générer les matchs</span>
            </button>

            {hasUnsavedChanges && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setHasUnsavedChanges(false);
                  setSwapSource(null);
                }}
              >
                Réinitialiser le brouillon
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
