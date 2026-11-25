"use client";

import { useState, type FormEvent } from "react";
import {
  CheckIcon,
  EditIcon,
  FlagIcon,
  LockIcon,
  MegaphoneIcon,
  TableCardsIcon,
} from "@/components/icons/Icons";
import {
  findTeamById,
  formatAnnouncementLabel,
  formatMatchPhaseLabel,
  formatMatchStatusBadge,
  formatPopupPhaseLabel,
} from "@/components/admin/admin-demo-data";
import type {
  AdminLiveFeedEntry,
  AdminMatchRecord,
} from "@/components/admin/admin-types";
import { deriveTableAccessCode } from "@/lib/auth/table-code";
import type { TournamentTeamInput } from "@/lib/tournament";
import {
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
} from "@/lib/tournament/live-store";
import type {
  AnnouncementType,
  LivePopupPhase,
  MatchStatus,
} from "@/types/database";

interface AdminTablesLiveGridProps {
  matches: AdminMatchRecord[];
  teams: TournamentTeamInput[];
  liveFeed: AdminLiveFeedEntry[];
  onForceUpdateMatch: (params: {
    matchId: string;
    scoreTeamA: number;
    scoreTeamB: number;
    status: MatchStatus;
    lockedByAdmin: boolean;
    forfeitTeamId: string | null;
  }) => void;
  onPushLiveAnnouncement: (params: {
    matchId: string;
    tableNumber: number;
    teamId: string | null;
    teamNameSnapshot: string;
    announcementType: AnnouncementType;
    phase: LivePopupPhase;
    pointsAwarded: number | null;
  }) => void;
}

type TableFilterMode = "all" | "active" | "completed" | "knockout";

export function AdminTablesLiveGrid(props: AdminTablesLiveGridProps) {
  const [filterMode, setFilterMode] = useState<TableFilterMode>("all");
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    props.matches[0]?.id ?? "",
  );

  let selectedMatch: AdminMatchRecord | null = null;
  for (const m of props.matches) {
    if (m.id === selectedMatchId) {
      selectedMatch = m;
      break;
    }
  }
  if (selectedMatch === null && props.matches[0] !== undefined) {
    selectedMatch = props.matches[0];
  }

  const [editScoreA, setEditScoreA] = useState<string>(
    String(selectedMatch?.scoreTeamA ?? 0),
  );
  const [editScoreB, setEditScoreB] = useState<string>(
    String(selectedMatch?.scoreTeamB ?? 0),
  );
  const [editStatus, setEditStatus] = useState<MatchStatus>(
    selectedMatch?.status ?? "in_progress",
  );
  const [editLocked, setEditLocked] = useState<boolean>(
    Boolean(selectedMatch?.lockedByAdmin),
  );

  const [announceType, setAnnounceType] = useState<AnnouncementType>("capot");
  const [announcePhase, setAnnouncePhase] = useState<LivePopupPhase>("passed");
  const [announceSide, setAnnounceSide] = useState<"team_a" | "team_b">(
    "team_a",
  );
  const [releaseNotice, setReleaseNotice] = useState<string | null>(null);

  async function handleReleaseTableMarker(matchId: string) {
    setReleaseNotice(null);
    try {
      const res = await fetch("/api/auth/table-claim", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      if (res.ok) {
        setReleaseNotice(
          "Téléphone marqueur libéré : un nouveau téléphone peut entrer le code Table.",
        );
      } else {
        setReleaseNotice("Impossible de libérer le marqueur (session admin requise).");
      }
    } catch {
      setReleaseNotice("Erreur réseau lors de la libération.");
    }
  }

  function handleSelectMatch(match: AdminMatchRecord) {
    setSelectedMatchId(match.id);
    setEditScoreA(String(match.scoreTeamA));
    setEditScoreB(String(match.scoreTeamB));
    setEditStatus(match.status);
    setEditLocked(match.lockedByAdmin);
  }

  function handleSaveOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedMatch === null) {
      return;
    }

    const parsedA = Math.max(
      0,
      Math.min(5000, Number.parseInt(editScoreA, 10) || 0),
    );
    const parsedB = Math.max(
      0,
      Math.min(5000, Number.parseInt(editScoreB, 10) || 0),
    );

    props.onForceUpdateMatch({
      matchId: selectedMatch.id,
      scoreTeamA: parsedA,
      scoreTeamB: parsedB,
      status: editStatus,
      lockedByAdmin: editLocked,
      forfeitTeamId: selectedMatch.forfeitTeamId,
    });
  }

  function handleDeclareForfeit(forfeitSide: "team_a" | "team_b") {
    if (selectedMatch === null) {
      return;
    }

    let forfeitTeamId: string | null = selectedMatch.teamAId;
    let nextScoreA = 0;
    let nextScoreB = 800;

    if (forfeitSide === "team_b") {
      forfeitTeamId = selectedMatch.teamBId;
      nextScoreA = 800;
      nextScoreB = 0;
    }

    setEditScoreA(String(nextScoreA));
    setEditScoreB(String(nextScoreB));
    setEditStatus("forfeit");
    setEditLocked(true);

    props.onForceUpdateMatch({
      matchId: selectedMatch.id,
      scoreTeamA: nextScoreA,
      scoreTeamB: nextScoreB,
      status: "forfeit",
      lockedByAdmin: true,
      forfeitTeamId,
    });
  }

  function handleTriggerLivePopup() {
    if (selectedMatch === null) {
      return;
    }

    const teamA = findTeamById(props.teams, selectedMatch.teamAId);
    const teamB = findTeamById(props.teams, selectedMatch.teamBId);

    let chosenTeamId = selectedMatch.teamAId;
    let chosenTeamName = "Equipe A";
    if (teamA !== null) {
      chosenTeamName = formatPlayersPrimaryName(
        teamA.player1Name,
        teamA.player2Name,
      );
    }

    if (announceSide === "team_b") {
      chosenTeamId = selectedMatch.teamBId;
      if (teamB !== null) {
        chosenTeamName = formatPlayersPrimaryName(
          teamB.player1Name,
          teamB.player2Name,
        );
      } else {
        chosenTeamName = "Equipe B";
      }
    }

    let pointsAwarded: number | null = null;
    if (announcePhase === "passed") {
      if (announceType === "capot") {
        pointsAwarded = 250;
      } else if (announceType === "generale") {
        pointsAwarded = 500;
      } else if (announceType === "coinche") {
        pointsAwarded = 260;
      } else {
        pointsAwarded = 520;
      }
    } else if (announcePhase === "failed") {
      if (announceType === "coinche") {
        pointsAwarded = 320;
      } else if (announceType === "surcoinche") {
        pointsAwarded = 640;
      } else {
        pointsAwarded = 160;
      }
    }

    let tableNum = 1;
    if (selectedMatch.tableNumber !== null) {
      tableNum = selectedMatch.tableNumber;
    }

    props.onPushLiveAnnouncement({
      matchId: selectedMatch.id,
      tableNumber: tableNum,
      teamId: chosenTeamId,
      teamNameSnapshot: chosenTeamName,
      announcementType: announceType,
      phase: announcePhase,
      pointsAwarded,
    });
  }

  const filteredMatches = props.matches.filter((match) => {
    if (filterMode === "active") {
      return match.status === "in_progress" || match.status === "pending";
    }
    if (filterMode === "completed") {
      return match.status === "completed" || match.status === "forfeit";
    }
    if (filterMode === "knockout") {
      return match.phase !== "pool";
    }
    return true;
  });

  const activeTablesCount = props.matches.filter(
    (m) => m.status === "in_progress",
  ).length;
  const completedCount = props.matches.filter(
    (m) => m.status === "completed" || m.status === "forfeit",
  ).length;

  let selectedTeamAName = "Equipe A";
  let selectedTeamBName = "Equipe B";
  if (selectedMatch !== null) {
    const tA = findTeamById(props.teams, selectedMatch.teamAId);
    const tB = findTeamById(props.teams, selectedMatch.teamBId);
    if (tA !== null) {
      selectedTeamAName = formatPlayersPrimaryName(
        tA.player1Name,
        tA.player2Name,
      );
    }
    if (tB !== null) {
      selectedTeamBName = formatPlayersPrimaryName(
        tB.player1Name,
        tB.player2Name,
      );
    }
  }

  return (
    <section
      className="admin-panel admin-panel-amber"
      aria-labelledby="admin-tables-heading"
    >
      <div className="admin-panel-header">
        <div className="admin-panel-title-wrap">
          <TableCardsIcon size={20} />
          <h2 id="admin-tables-heading" className="admin-panel-title">
            Tables en Direct &amp; Edition Forcee des Scores
          </h2>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <span className="badge badge-amber tabular-nums">
            {activeTablesCount} en jeu
          </span>
          <span className="badge badge-pass tabular-nums">
            {completedCount} termines
          </span>
        </div>
      </div>

      <div className="admin-tables-toolbar">
        <div className="admin-filter-pills" role="tablist">
          <button
            type="button"
            className="admin-filter-pill"
            data-active={String(filterMode === "all")}
            onClick={() => setFilterMode("all")}
          >
            Toutes ({props.matches.length})
          </button>
          <button
            type="button"
            className="admin-filter-pill"
            data-active={String(filterMode === "active")}
            onClick={() => setFilterMode("active")}
          >
            En cours / A jouer
          </button>
          <button
            type="button"
            className="admin-filter-pill"
            data-active={String(filterMode === "completed")}
            onClick={() => setFilterMode("completed")}
          >
            Terminees
          </button>
          <button
            type="button"
            className="admin-filter-pill"
            data-active={String(filterMode === "knockout")}
            onClick={() => setFilterMode("knockout")}
          >
            Phase Finale
          </button>
        </div>

        <span className="admin-subtitle">
          Cliquez sur une table pour forcer un score, verrouiller ou declarer un
          forfait.
        </span>
      </div>

      {selectedMatch !== null && (
        <form className="admin-override-box" onSubmit={handleSaveOverride}>
          <div className="admin-panel-header">
            <div>
              <span className="eyebrow">
                <EditIcon size={13} />
                <span>
                  Edition Forcee Admin · Table{" "}
                  {selectedMatch.tableNumber ?? "Exempt"} ·{" "}
                  {selectedMatch.poolLabel ??
                    formatMatchPhaseLabel(selectedMatch.phase)}{" "}
                  (Tour {selectedMatch.roundNumber})
                </span>
              </span>
              <h3
                className="section-title"
                style={{ fontSize: "19px", marginTop: "2px" }}
              >
                {selectedTeamAName} contre {selectedTeamBName}
              </h3>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "6px",
                }}
              >
                <span className="badge badge-amber tabular-nums">
                  Code Table :{" "}
                  {deriveTableAccessCode(
                    selectedMatch.id,
                    selectedMatch.tableNumber,
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    void handleReleaseTableMarker(selectedMatch.id);
                  }}
                >
                  Libérer téléphone marqueur
                </button>
              </div>
              {releaseNotice !== null && (
                <p
                  className="admin-subtitle"
                  style={{
                    marginTop: "4px",
                    color: "var(--status-pass)",
                    fontWeight: 700,
                  }}
                >
                  {releaseNotice}
                </p>
              )}
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12.5px",
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={editLocked}
                onChange={(e) => setEditLocked(e.target.checked)}
              />
              <LockIcon size={14} />
              <span>Verrouiller cette table (`locked_by_admin`)</span>
            </label>
          </div>

          <div className="admin-override-scores">
            <div className="admin-override-field">
              <label
                className="field-label"
                htmlFor="admin-override-score-a"
              >
                Score {selectedTeamAName}
              </label>
              <input
                id="admin-override-score-a"
                type="number"
                min={0}
                max={5000}
                step={10}
                className="field-input field-input-score"
                value={editScoreA}
                onChange={(e) => setEditScoreA(e.target.value)}
              />
            </div>

            <div className="admin-override-field">
              <label
                className="field-label"
                htmlFor="admin-override-score-b"
              >
                Score {selectedTeamBName}
              </label>
              <input
                id="admin-override-score-b"
                type="number"
                min={0}
                max={5000}
                step={10}
                className="field-input field-input-score"
                value={editScoreB}
                onChange={(e) => setEditScoreB(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-override-actions">
            <select
              className="field-input"
              style={{ width: "auto", minHeight: "38px", fontSize: "13px" }}
              aria-label="Statut du match"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as MatchStatus)}
            >
              <option value="pending">A lancer</option>
              <option value="in_progress">En cours</option>
              <option value="completed">Termine (Valide)</option>
              <option value="forfeit">Forfait</option>
            </select>

            <button type="submit" className="btn btn-sm btn-primary">
              <CheckIcon size={15} />
              <span>Enregistrer le score force</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-ghost-danger"
              onClick={() => handleDeclareForfeit("team_a")}
            >
              <FlagIcon size={14} />
              <span>Forfait {selectedTeamAName}</span>
            </button>

            <button
              type="button"
              className="btn btn-sm btn-ghost-danger"
              onClick={() => handleDeclareForfeit("team_b")}
            >
              <FlagIcon size={14} />
              <span>Forfait {selectedTeamBName}</span>
            </button>
          </div>

          <div
            style={{
              paddingTop: "10px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink-secondary)",
              }}
            >
              Annonce rectificative `/live` :
            </span>
            <select
              className="admin-auth-input"
              aria-label="Equipe de l'annonce"
              value={announceSide}
              onChange={(e) =>
                setAnnounceSide(e.target.value as "team_a" | "team_b")
              }
            >
              <option value="team_a">{selectedTeamAName}</option>
              <option value="team_b">{selectedTeamBName}</option>
            </select>

            <select
              className="admin-auth-input"
              aria-label="Type d'annonce"
              value={announceType}
              onChange={(e) =>
                setAnnounceType(e.target.value as AnnouncementType)
              }
            >
              <option value="capot">Capot (250 pts)</option>
              <option value="generale">Generale (500 pts)</option>
              <option value="coinche">Coinche (x2)</option>
              <option value="surcoinche">Surcoinche (x4)</option>
            </select>

            <select
              className="admin-auth-input"
              aria-label="Resultat de l'annonce"
              value={announcePhase}
              onChange={(e) =>
                setAnnouncePhase(e.target.value as LivePopupPhase)
              }
            >
              <option value="announced">Annonce en cours</option>
              <option value="passed">Passe</option>
              <option value="failed">Chute</option>
            </select>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={handleTriggerLivePopup}
            >
              <MegaphoneIcon size={14} />
              <span>Diffuser pop-up sur /live</span>
            </button>
          </div>
        </form>
      )}

      <div className="admin-tables-grid">
        {filteredMatches.map((match) => {
          const teamA = findTeamById(props.teams, match.teamAId);
          const teamB = findTeamById(props.teams, match.teamBId);
          const statusMeta = formatMatchStatusBadge(match.status);
          const isSelected = selectedMatch?.id === match.id;

          let nameA = "En attente";
          let nickA: string | null = null;
          if (teamA !== null) {
            nameA = formatPlayersPrimaryName(teamA.player1Name, teamA.player2Name);
            nickA = formatOptionalTeamNickname(
              teamA.teamName,
              teamA.player1Name,
              teamA.player2Name,
            );
          }
          let nameB = "En attente";
          let nickB: string | null = null;
          if (teamB !== null) {
            nameB = formatPlayersPrimaryName(teamB.player1Name, teamB.player2Name);
            nickB = formatOptionalTeamNickname(
              teamB.teamName,
              teamB.player1Name,
              teamB.player2Name,
            );
          }

          let tableHeading = "Exempt";
          if (match.tableNumber !== null) {
            tableHeading = `Table ${match.tableNumber}`;
          }

          let contextLabel = formatMatchPhaseLabel(match.phase);
          if (match.poolLabel !== null) {
            contextLabel = `${match.poolLabel} · Tour ${match.roundNumber}`;
          }

          let dealsInfo = `${match.dealsPlayed}/${match.maxDeals ?? 5} donnes`;
          if (match.targetScore !== null) {
            dealsInfo = `Objectif ${match.targetScore} pts`;
          }

          return (
            <article
              key={match.id}
              className="admin-table-card"
              data-selected={String(isSelected)}
              data-locked={String(match.lockedByAdmin)}
              onClick={() => handleSelectMatch(match)}
            >
              <div className="admin-table-card-head">
                <span className="admin-table-num">{tableHeading}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {match.lockedByAdmin && (
                    <span className="badge badge-terracotta">
                      <LockIcon size={11} />
                      <span>Verrou</span>
                    </span>
                  )}
                  <span className={statusMeta.badgeClass}>
                    {statusMeta.label}
                  </span>
                </div>
              </div>

              <div className="admin-table-teams">
                <div
                  className="admin-table-team-row"
                  data-winner={String(
                    match.winnerTeamId !== null &&
                      match.winnerTeamId === match.teamAId,
                  )}
                >
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span className="admin-table-team-name">{nameA}</span>
                    {nickA !== null && (
                      <span style={{ fontSize: "10.5px", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {nickA}
                      </span>
                    )}
                  </div>
                  <span className="admin-table-team-score">
                    {match.scoreTeamA}
                  </span>
                </div>

                <div
                  className="admin-table-team-row"
                  data-winner={String(
                    match.winnerTeamId !== null &&
                      match.winnerTeamId === match.teamBId,
                  )}
                >
                  <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                    <span className="admin-table-team-name">{nameB}</span>
                    {nickB !== null && (
                      <span style={{ fontSize: "10.5px", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {nickB}
                      </span>
                    )}
                  </div>
                  <span className="admin-table-team-score">
                    {match.scoreTeamB}
                  </span>
                </div>
              </div>

              <div className="admin-table-card-foot">
                <span>{contextLabel}</span>
                <span className="tabular-nums">{dealsInfo}</span>
              </div>
            </article>
          );
        })}
      </div>

      {props.liveFeed.length > 0 && (
        <div
          style={{
            paddingTop: "10px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--ink-secondary)",
            }}
          >
            Derniers pop-ups `/live` :
          </span>
          {props.liveFeed.slice(0, 4).map((item) => (
            <span key={item.id} className="badge badge-neutral">
              Table {item.tableNumber} · {item.teamName} ·{" "}
              {formatAnnouncementLabel(item.announcementType)} ·{" "}
              {formatPopupPhaseLabel(item.phase)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
