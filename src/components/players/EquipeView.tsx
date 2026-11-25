"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ClubAccountGateCard } from "@/components/auth/ClubAccountGateCard";
import { normalizeComparisonKey } from "@/lib/security/sanitize";
import {
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  updateUnifiedTournamentState,
  type UnifiedTeamRecord,
} from "@/lib/tournament/live-store";
import {
  readMyTeamIdFromStorage,
  saveMyTeamIdToStorage,
  searchTeamsByFirstName,
} from "@/lib/tournament/player-lookup";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  TableCardsIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons/Icons";

interface PublicAuthProfile {
  id: string;
  displayName: string;
  role: "player" | "admin";
  schoolYear: string;
}

interface AuthMeResponse {
  profile: PublicAuthProfile | null;
  teamSession: {
    teamId: string;
    tournamentId: string;
    expiresAt: number;
  } | null;
}

const PREVIEW_TEAM_STORAGE_KEY = "coincheirb-preview-team";

function formatRankLabel(rank: number | null, poolSize: number): string {
  if (rank === null) {
    return "En attente";
  }
  if (rank === 1) {
    return `1er / ${poolSize}`;
  }
  return `${rank}e / ${poolSize}`;
}

/**
 * Page Mon equipe (/equipe) optimisee a 375 px :
 * - Connectee en direct au store temps reel unifie (les 20 equipes + celles ajoutees dans `/admin`)
 * - Affiche la poule, le rang, le goal-average et les matchs reels mis a jour par `/ma-table`
 * - Permet d'ouvrir directement `/ma-table?match=<id>` sur n'importe quel match du binome.
 */
export function EquipeView() {
  const { state, summary, hydrated } = useTournamentStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [quickFirstName, setQuickFirstName] = useState<string>("");
  const [isServerSession, setIsServerSession] = useState<boolean>(false);

  const [teamIdentifier, setTeamIdentifier] = useState<string>("");
  const [teamAccessCode, setTeamAccessCode] = useState<string>("");
  const [accessLoading, setAccessLoading] = useState<boolean>(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  const [playerProfile, setPlayerProfile] = useState<PublicAuthProfile | null>(
    null,
  );
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [linkSlot, setLinkSlot] = useState<"player_1" | "player_2">("player_1");
  const [linkCode, setLinkCode] = useState<string>("");
  const [linkLoading, setLinkLoading] = useState<boolean>(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || state.teams.length === 0) {
      return;
    }

    try {
      const mySaved = readMyTeamIdFromStorage();
      if (mySaved !== null && findUnifiedTeam(state.teams, mySaved) !== null) {
        setSelectedTeamId(mySaved);
        return;
      }
      const saved = window.localStorage.getItem(PREVIEW_TEAM_STORAGE_KEY);
      if (saved !== null) {
        const q = normalizeComparisonKey(saved);
        const found = state.teams.find(
          (t) =>
            t.id === saved ||
            normalizeComparisonKey(t.shortCode) === q ||
            t.normalizedName === q,
        );
        if (found !== undefined) {
          setSelectedTeamId(found.id);
          return;
        }
      }
    } catch {
      // Ignore
    }

    const first = state.teams[0];
    if (first !== undefined && selectedTeamId === "") {
      setSelectedTeamId(first.id);
    }
  }, [hydrated, state.teams, selectedTeamId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSessionState() {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" });
        if (res.ok) {
          const data = (await res.json()) as AuthMeResponse;
          if (!cancelled) {
            setPlayerProfile(data.profile);
            if (data.teamSession !== null) {
              setIsServerSession(true);
            }
          }
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    }

    void loadSessionState();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTeam(team: UnifiedTeamRecord, notice: string | null) {
    setSelectedTeamId(team.id);
    setAccessError(null);
    setAccessNotice(notice);
    saveMyTeamIdToStorage(team.id);
    try {
      window.localStorage.setItem(PREVIEW_TEAM_STORAGE_KEY, team.id);
    } catch {
      // Ignore
    }
  }

  const quickFirstNameMatches = useMemo(() => {
    if (quickFirstName.trim().length < 1) {
      return [];
    }
    return searchTeamsByFirstName(state.teams, quickFirstName).slice(0, 5);
  }, [state.teams, quickFirstName]);

  let activeTeam: UnifiedTeamRecord | null = findUnifiedTeam(
    state.teams,
    selectedTeamId,
  );
  if (activeTeam === null && state.teams[0] !== undefined) {
    activeTeam = state.teams[0];
  }

  const teamStanding = useMemo(() => {
    if (activeTeam === null) {
      return null;
    }
    for (const pool of summary.poolStandings) {
      for (const row of pool.standings) {
        if (row.teamId === activeTeam.id) {
          return {
            poolLabel: pool.poolLabel,
            poolSize: pool.standings.length,
            row,
          };
        }
      }
    }
    return null;
  }, [activeTeam, summary.poolStandings]);

  const teamMatches = useMemo(() => {
    if (activeTeam === null) {
      return [];
    }
    return state.matches.filter(
      (m) => m.teamAId === activeTeam.id || m.teamBId === activeTeam.id,
    );
  }, [activeTeam, state.matches]);

  async function handleTeamAccessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedId = teamIdentifier.trim();
    const trimmedCode = teamAccessCode.trim();

    if (trimmedId.length < 2) {
      setAccessError(
        "Saisissez un pseudo d'équipe, un prénom ou un code court (ex. A01, B02).",
      );
      setAccessNotice(null);
      return;
    }

    setAccessLoading(true);
    setAccessError(null);
    setAccessNotice(null);

    const q = normalizeComparisonKey(trimmedId);
    const localMatch = state.teams.find(
      (t) =>
        normalizeComparisonKey(t.shortCode) === q ||
        t.normalizedName.includes(q) ||
        normalizeComparisonKey(t.player1Name).includes(q) ||
        normalizeComparisonKey(t.player2Name).includes(q),
    );

    if (trimmedCode.length >= 4) {
      try {
        const res = await fetch("/api/auth/team-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tournamentId: state.tournament.id,
            teamIdentifier: trimmedId,
            accessCode: trimmedCode,
          }),
        });
        if (res.ok) {
          setIsServerSession(true);
        }
      } catch {
        // Fallback store local
      }
    }

    if (localMatch !== undefined) {
      selectTeam(
        localMatch,
        `Équipe sélectionnée : ${localMatch.teamName} (${localMatch.shortCode}).`,
      );
      setTeamIdentifier("");
      setTeamAccessCode("");
    } else {
      setAccessError(
        "Aucune équipe trouvée avec ce nom ou ce code dans le tournoi actuel.",
      );
    }

    setAccessLoading(false);
  }

  async function handleLinkPlayerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (playerProfile === null || activeTeam === null) {
      setLinkError("Connectez d'abord votre compte joueur dans Settings.");
      return;
    }

    const trimmedCode = linkCode.trim();
    if (trimmedCode.length < 2) {
      setLinkError("Saisissez le code court de l'équipe (ex. A01) pour confirmer.");
      return;
    }

    setLinkLoading(true);
    setLinkError(null);
    setLinkSuccess(null);

    const targetId = activeTeam.id;
    updateUnifiedTournamentState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id !== targetId) {
          return t;
        }
        if (linkSlot === "player_1") {
          return { ...t, player1LinkedAccount: playerProfile.displayName };
        }
        return { ...t, player2LinkedAccount: playerProfile.displayName };
      }),
    }));

    let slotLabel = "Joueur 2";
    if (linkSlot === "player_1") {
      slotLabel = "Joueur 1";
    }
    setLinkSuccess(
      `Profil ${playerProfile.displayName} rattaché au poste ${slotLabel} de ${activeTeam.teamName}.`,
    );
    setLinkCode("");
    setLinkLoading(false);
  }

  if (activeTeam === null) {
    return (
      <div className="container-mobile">
        <section className="card-ruled">
          <span className="eyebrow">Mon équipe</span>
          <p style={{ margin: "6px 0 0", fontSize: "14px" }}>
            Aucune équipe inscrite pour le moment. Ajoutez ou importez les
            équipes dans le poste Admin.
          </p>
        </section>
      </div>
    );
  }

  let checkInBadgeClass = "badge badge-amber";
  let checkInBadgeLabel = "Check-in en attente";
  if (activeTeam.isForfeit) {
    checkInBadgeClass = "badge badge-fail";
    checkInBadgeLabel = "Forfait déclaré";
  } else if (activeTeam.checkedIn) {
    checkInBadgeClass = "badge badge-pass";
    checkInBadgeLabel = "Check-in validé";
  }

  let sessionTag = "Synchronisé temps réel";
  if (isServerSession) {
    sessionTag = "Session vérifiée";
  }

  let slot1Active = "false";
  let slot2Active = "false";
  if (linkSlot === "player_1") {
    slot1Active = "true";
  } else {
    slot2Active = "true";
  }

  let slot1Display = "Non rattaché";
  if (activeTeam.player1LinkedAccount !== null) {
    slot1Display = `Compte lié : ${activeTeam.player1LinkedAccount}`;
  }

  let slot2Display = "Non rattaché";
  if (activeTeam.player2LinkedAccount !== null) {
    slot2Display = `Compte lié : ${activeTeam.player2LinkedAccount}`;
  }

  let poolLabelText = "Tirage en attente";
  let rankLabelText = "–";
  let pointsScoredVal = 0;
  let winsVal = 0;
  let lossesVal = 0;

  if (teamStanding !== null) {
    poolLabelText = teamStanding.poolLabel;
    rankLabelText = formatRankLabel(
      teamStanding.row.poolRank,
      teamStanding.poolSize,
    );
    pointsScoredVal = teamStanding.row.pointsScored;
    winsVal = teamStanding.row.matchesWon;
    lossesVal = teamStanding.row.matchesLost;
  }

  let accessSubmitLabel = "Rechercher et charger l'équipe";
  if (accessLoading) {
    accessSubmitLabel = "Recherche...";
  }

  let linkSubmitLabel = "Rattacher mon profil à cette équipe";
  if (linkLoading) {
    linkSubmitLabel = "Rattachement...";
  }

  return (
    <div className="container-mobile">
      <div className="players-stack">
        <ClubAccountGateCard
          title="Mon compte Coinch'Eirb (pseudo + mot de passe)"
          compact
        />

        {/* Recherche instantanée par PRÉNOM */}
        <section className="card-ruled" aria-label="Trouver mon équipe par prénom">
          <label htmlFor="equipe-firstname-input" className="field-label">
            Tape ton prénom pour afficher ton binôme et tes adversaires :
          </label>
          <input
            id="equipe-firstname-input"
            type="text"
            className="field-input"
            style={{ minHeight: "42px", fontSize: "14px" }}
            placeholder="Ex. Angèle, Chahe, Lucas..."
            value={quickFirstName}
            onChange={(e) => setQuickFirstName(e.target.value)}
            autoComplete="given-name"
          />

          {quickFirstNameMatches.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginTop: "8px",
              }}
            >
              {quickFirstNameMatches.map((cand) => (
                <button
                  key={cand.team.id}
                  type="button"
                  onClick={() => {
                    selectTeam(cand.team, null);
                    setQuickFirstName("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-strong)",
                    backgroundColor: "var(--bg-surface-alt)",
                    color: "var(--ink-primary)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div>
                    <div
                      className="font-display"
                      style={{
                        fontSize: "17px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                      }}
                    >
                      {cand.playersPrimary}
                    </div>
                    {cand.nickname !== null && (
                      <div
                        style={{
                          fontSize: "11.5px",
                          fontWeight: 600,
                          color: "var(--accent-terracotta)",
                        }}
                      >
                        « {cand.nickname} »
                      </div>
                    )}
                  </div>
                  <ArrowRightIcon
                    size={15}
                    style={{ color: "var(--accent-amber)", flexShrink: 0 }}
                  />
                </button>
              ))}
            </div>
          )}

          <label
            htmlFor="equipe-select"
            className="field-label"
            style={{ marginTop: "10px" }}
          >
            Ou choisir dans la liste ({state.teams.length} binômes) :
          </label>
          <select
            id="equipe-select"
            className="field-input"
            style={{ minHeight: "42px", fontWeight: 700, fontSize: "13.5px" }}
            value={activeTeam.id}
            onChange={(e) => {
              const chosen = findUnifiedTeam(state.teams, e.target.value);
              if (chosen !== null) {
                selectTeam(chosen, null);
              }
            }}
          >
            {state.teams.map((t) => {
              const primaryLabel = formatPlayersPrimaryName(
                t.player1Name,
                t.player2Name,
              );
              const optNick = formatOptionalTeamNickname(
                t.teamName,
                t.player1Name,
                t.player2Name,
              );
              let optionText = `${t.shortCode} · ${primaryLabel}`;
              if (optNick !== null) {
                optionText = `${t.shortCode} · ${primaryLabel} (${optNick})`;
              }
              return (
                <option key={t.id} value={t.id}>
                  {optionText}
                </option>
              );
            })}
          </select>
        </section>

        {/* En-tête fiche équipe */}
        <section className="players-header-card" aria-labelledby="team-heading">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span className="eyebrow">
              <UsersIcon size={13} />
              <span>
                Code {activeTeam.shortCode} · {sessionTag}
              </span>
            </span>
            <span className={checkInBadgeClass}>{checkInBadgeLabel}</span>
          </div>

          <h1 id="team-heading" className="page-title">
            {formatPlayersPrimaryName(
              activeTeam.player1Name,
              activeTeam.player2Name,
            )}
          </h1>

          {formatOptionalTeamNickname(
            activeTeam.teamName,
            activeTeam.player1Name,
            activeTeam.player2Name,
          ) !== null && (
            <p
              style={{
                margin: "2px 0 8px",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--ink-muted)",
              }}
            >
              Surnom :{" "}
              {formatOptionalTeamNickname(
                activeTeam.teamName,
                activeTeam.player1Name,
                activeTeam.player2Name,
              )}
            </p>
          )}

          <div className="team-players-pair">
            <div className="team-player-pill">
              <span className="team-player-slot">Joueur 1</span>
              <span className="team-player-name">{activeTeam.player1Name}</span>
              <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                {slot1Display}
              </span>
            </div>
            <div className="team-player-pill">
              <span className="team-player-slot">Joueur 2</span>
              <span className="team-player-name">{activeTeam.player2Name}</span>
              <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                {slot2Display}
              </span>
            </div>
          </div>

          <div className="team-kpi-grid">
            <div className="team-kpi-box">
              <span className="team-kpi-label">Poule assignée</span>
              <span className="team-kpi-value">{poolLabelText}</span>
            </div>
            <div className="team-kpi-box">
              <span className="team-kpi-label">Rang actuel</span>
              <span className="team-kpi-value">{rankLabelText}</span>
            </div>
            <div className="team-kpi-box">
              <span className="team-kpi-label">Goal-average</span>
              <span className="team-kpi-value">{pointsScoredVal} pts</span>
            </div>
            <div className="team-kpi-box">
              <span className="team-kpi-label">Bilan soirée</span>
              <span className="team-kpi-value">
                {winsVal} V · {lossesVal} D
              </span>
            </div>
          </div>
        </section>

        {/* Historique des matchs de la soirée */}
        <section className="card" aria-labelledby="matches-heading">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <h2 id="matches-heading" className="section-title">
              Matchs de la soirée
            </h2>
            <span className="badge badge-neutral">
              {teamMatches.length} match(s)
            </span>
          </div>

          {teamMatches.length === 0 && (
            <p className="players-lead" style={{ marginTop: "8px" }}>
              Aucun match planifié pour le moment (en attente de la génération
              des poules à 18h30).
            </p>
          )}

          <ul className="match-history-list">
            {teamMatches.map((match) => {
              const isSideA = match.teamAId === activeTeam.id;
              let opponentId = match.teamBId;
              let scoreUs = match.scoreTeamA;
              let scoreThem = match.scoreTeamB;
              if (!isSideA) {
                opponentId = match.teamAId;
                scoreUs = match.scoreTeamB;
                scoreThem = match.scoreTeamA;
              }

              const opponent = findUnifiedTeam(state.teams, opponentId);
              let opponentName = "À déterminer";
              let opponentNick: string | null = null;
              if (opponent !== null) {
                opponentName = formatPlayersPrimaryName(
                  opponent.player1Name,
                  opponent.player2Name,
                );
                opponentNick = formatOptionalTeamNickname(
                  opponent.teamName,
                  opponent.player1Name,
                  opponent.player2Name,
                );
              }

              let roundLabel = `Tour ${match.roundNumber} · ${match.poolLabel ?? "Poules"}`;
              if (match.phase === "round_of_16") {
                roundLabel = "Huitième de finale · 500 pts";
              } else if (match.phase === "quarterfinals") {
                roundLabel = "Quart de finale · 600 pts";
              } else if (match.phase === "semifinals") {
                roundLabel = "Demi-finale · 700 pts";
              } else if (match.phase === "final") {
                roundLabel = "Finale · 1000 pts";
              }

              let liveAttr = "false";
              let statusBadge = (
                <span className="badge badge-neutral">
                  <ClockIcon size={11} />
                  <span>À venir</span>
                </span>
              );
              let scoreDisplay = "–";

              if (match.status === "in_progress") {
                liveAttr = "true";
                statusBadge = (
                  <span className="badge badge-amber">En cours</span>
                );
                scoreDisplay = `${scoreUs} – ${scoreThem}`;
              } else if (
                match.status === "completed" ||
                match.status === "forfeit"
              ) {
                if (match.winnerTeamId === activeTeam.id) {
                  statusBadge = (
                    <span className="badge badge-pass">
                      <CheckIcon size={11} />
                      <span>Victoire</span>
                    </span>
                  );
                } else {
                  statusBadge = (
                    <span className="badge badge-fail">Défaite</span>
                  );
                }
                scoreDisplay = `${scoreUs} – ${scoreThem}`;
              }

              return (
                <li
                  key={match.id}
                  className="match-history-card"
                  data-live={liveAttr}
                >
                  <div className="match-history-top">
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--ink-secondary)",
                      }}
                    >
                      {roundLabel} · Table {match.tableNumber ?? "–"}
                    </span>
                    {statusBadge}
                  </div>

                  <div className="match-history-vs">
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <span className="match-history-opponent">
                        vs {opponentName}
                      </span>
                      {opponentNick !== null && (
                        <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                          {opponentNick}
                        </span>
                      )}
                    </div>
                    <span className="match-history-score">{scoreDisplay}</span>
                  </div>

                  <Link
                    href={`/ma-table?match=${encodeURIComponent(match.id)}`}
                    className="btn btn-primary btn-sm"
                  >
                    <TableCardsIcon size={16} />
                    <span>Ouvrir la feuille de marque (Table {match.tableNumber ?? "–"})</span>
                    <ArrowRightIcon size={15} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Accès rapide d'équipe */}
        <section className="card" aria-labelledby="quick-access-heading">
          <span className="eyebrow">Recherche rapide</span>
          <h2
            id="quick-access-heading"
            className="section-title"
            style={{ marginTop: "4px" }}
          >
            Rechercher par pseudo ou code court
          </h2>

          <form
            className="settings-form-stack"
            onSubmit={handleTeamAccessSubmit}
            noValidate
          >
            <div>
              <label htmlFor="team-identifier-input" className="field-label">
                Nom d&apos;équipe, prénom ou code (ex. A01, B02, C01)
              </label>
              <input
                id="team-identifier-input"
                type="text"
                className="field-input"
                placeholder="Ex. La Ruche Dorée ou C01"
                value={teamIdentifier}
                onChange={(event) => setTeamIdentifier(event.target.value)}
                maxLength={60}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="team-code-input" className="field-label">
                Code secret de session table (optionnel hors connexion)
              </label>
              <input
                id="team-code-input"
                type="text"
                className="field-input"
                placeholder="Optionnel en mode local"
                value={teamAccessCode}
                onChange={(event) => setTeamAccessCode(event.target.value)}
                maxLength={16}
                autoComplete="off"
              />
            </div>

            {accessError !== null && (
              <div className="banner banner-fail" role="alert">
                {accessError}
              </div>
            )}

            {accessNotice !== null && (
              <div className="banner banner-pass" role="status">
                {accessNotice}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-secondary btn-full"
              disabled={accessLoading}
            >
              {accessSubmitLabel}
            </button>
          </form>
        </section>

        {/* Liaison compte joueur annuel */}
        <section className="card-ruled" aria-labelledby="link-player-heading">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TrophyIcon
              size={18}
              style={{ color: "var(--accent-amber)", flexShrink: 0 }}
            />
            <h2 id="link-player-heading" className="section-title">
              Compte joueur annuel (optionnel)
            </h2>
          </div>

          <p className="players-lead" style={{ marginTop: "6px" }}>
            Rattachez votre profil Coinch&apos;Eirb à Joueur 1 ou Joueur 2 pour
            cumuler vos points sur l&apos;année scolaire 2026-2027.
          </p>

          {authChecking && (
            <p className="rules-note-line">Vérification de votre session...</p>
          )}

          {!authChecking && playerProfile === null && (
            <div className="settings-form-stack">
              <div className="banner banner-info">
                <LockIcon
                  size={16}
                  style={{ flexShrink: 0, marginTop: "2px" }}
                />
                <span>
                  Aucun compte joueur connecté. Le compte reste 100 % facultatif
                  pour jouer ce soir.
                </span>
              </div>
              <Link href="/settings" className="btn btn-primary btn-full">
                <span>Se connecter ou créer un compte</span>
                <ArrowRightIcon size={17} />
              </Link>
            </div>
          )}

          {!authChecking && playerProfile !== null && (
            <form
              className="settings-form-stack"
              onSubmit={handleLinkPlayerSubmit}
              noValidate
            >
              <div className="banner banner-pass">
                <span>
                  Connecté en tant que{" "}
                  <strong>{playerProfile.displayName}</strong> (
                  {playerProfile.schoolYear})
                </span>
              </div>

              <div>
                <span className="field-label">Poste dans l&apos;équipe</span>
                <div className="segmented" role="group" aria-label="Poste joueur">
                  <button
                    type="button"
                    className="segmented-btn"
                    data-active={slot1Active}
                    onClick={() => setLinkSlot("player_1")}
                  >
                    Joueur 1 ({activeTeam.player1Name})
                  </button>
                  <button
                    type="button"
                    className="segmented-btn"
                    data-active={slot2Active}
                    onClick={() => setLinkSlot("player_2")}
                  >
                    Joueur 2 ({activeTeam.player2Name})
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="link-access-code" className="field-label">
                  Code court d&apos;équipe (ex. {activeTeam.shortCode})
                </label>
                <input
                  id="link-access-code"
                  type="text"
                  className="field-input"
                  placeholder={`Ex. ${activeTeam.shortCode}`}
                  value={linkCode}
                  onChange={(event) => setLinkCode(event.target.value)}
                  maxLength={16}
                  autoComplete="off"
                />
              </div>

              {linkError !== null && (
                <div className="banner banner-fail" role="alert">
                  {linkError}
                </div>
              )}

              {linkSuccess !== null && (
                <div className="banner banner-pass" role="status">
                  {linkSuccess}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={linkLoading}
              >
                {linkSubmitLabel}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
