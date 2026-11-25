"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  findUnifiedTeam,
  type UnifiedMatchRecord,
} from "@/lib/tournament/live-store";
import {
  readMyTeamIdFromStorage,
  resolveTeamMatchTimeline,
  saveMyTeamIdToStorage,
  searchTeamsByFirstName,
} from "@/lib/tournament/player-lookup";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import {
  ArrowRightIcon,
  ClockIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  LockIcon,
  ProjectorScreenIcon,
  SpadeSuitIcon,
  TableCardsIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons/Icons";

interface HomeViewProps {
  posterUrl: string;
  tournamentTitle: string;
  startTimeLabel: string;
}

function formatQuickPhaseLabel(match: UnifiedMatchRecord): string {
  if (match.phase === "pool") {
    if (match.poolLabel !== null) {
      return `${match.poolLabel} · Tour ${match.roundNumber}`;
    }
    return `Poules · Tour ${match.roundNumber}`;
  }
  if (match.phase === "round_of_16") {
    return "Huitième · 500 pts";
  }
  if (match.phase === "quarterfinals") {
    return "Quart · 600 pts";
  }
  if (match.phase === "semifinals") {
    return "Demi-finale · 700 pts";
  }
  return "Finale · 1000 pts";
}

/**
 * Ecran d'accueil Coinch'Eirb :
 * - Acces instantane a sa table en tapant simplement son PRENOM (trouve le binome + adversaire + table)
 * - Raccourcis visibles vers Grand Ecran (/live), Classement & Arbre (/classement) et Poste Admin (/admin)
 * - Affiche dynamique synchronisee avec l'upload Admin.
 */
export function HomeView(props: HomeViewProps) {
  const router = useRouter();
  const { state, hydrated } = useTournamentStore();
  const [firstNameQuery, setFirstNameQuery] = useState("");
  const [savedTeamId, setSavedTeamId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const stored = readMyTeamIdFromStorage();
    if (stored !== null && findUnifiedTeam(state.teams, stored) !== null) {
      setSavedTeamId(stored);
    }
  }, [hydrated, state.teams]);

  let activePosterUrl = props.posterUrl;
  let activeTitle = props.tournamentTitle;
  let activeStart = props.startTimeLabel;

  if (hydrated) {
    activePosterUrl = state.tournament.posterUrl;
    activeTitle = state.tournament.title;
    activeStart = `1er tour à ${state.tournament.startsAtLabel}`;
  }

  const matchingCandidates = useMemo(() => {
    if (!hydrated || firstNameQuery.trim().length < 1) {
      return [];
    }
    return searchTeamsByFirstName(state.teams, firstNameQuery).slice(0, 5);
  }, [hydrated, state.teams, firstNameQuery]);

  const savedTeam = useMemo(() => {
    if (!hydrated || savedTeamId === null) {
      return null;
    }
    return findUnifiedTeam(state.teams, savedTeamId);
  }, [hydrated, savedTeamId, state.teams]);

  const savedTimeline = useMemo(() => {
    if (savedTeam === null) {
      return null;
    }
    return resolveTeamMatchTimeline(savedTeam.id, state.matches, state.teams);
  }, [savedTeam, state.matches, state.teams]);

  function openTeamDirectly(teamId: string) {
    saveMyTeamIdToStorage(teamId);
    const timeline = resolveTeamMatchTimeline(
      teamId,
      state.matches,
      state.teams,
    );
    if (timeline.currentMatch !== null) {
      router.push(
        `/ma-table?team=${encodeURIComponent(teamId)}&match=${encodeURIComponent(timeline.currentMatch.id)}`,
      );
      return;
    }
    router.push(`/ma-table?team=${encodeURIComponent(teamId)}`);
  }

  function handleQuickAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = firstNameQuery.trim();
    if (cleaned.length < 1) {
      setFormError("Tape simplement ton prénom (ex. Angèle, Chahe, Lucas...).");
      return;
    }
    setFormError(null);

    if (/^[0-9]+$/.test(cleaned)) {
      router.push(`/ma-table?table=${encodeURIComponent(cleaned)}`);
      return;
    }

    const matches = searchTeamsByFirstName(state.teams, cleaned);
    if (matches.length === 1 && matches[0] !== undefined) {
      openTeamDirectly(matches[0].team.id);
      return;
    }
    if (matches.length > 1) {
      setFormError(
        "Plusieurs joueurs correspondent : clique sur ton binôme ci-dessous.",
      );
      return;
    }

    setFormError(
      `Aucun joueur trouvé pour "${cleaned}". Vérifie l'orthographe de ton prénom ou demande à l'admin.`,
    );
  }

  let savedTeamPlayers = "";
  let savedTeamNick: string | null = null;
  let savedOpponentText = "En attente du tirage";
  if (savedTeam !== null) {
    savedTeamPlayers = formatPlayersPrimaryName(
      savedTeam.player1Name,
      savedTeam.player2Name,
    );
    savedTeamNick = formatOptionalTeamNickname(
      savedTeam.teamName,
      savedTeam.player1Name,
      savedTeam.player2Name,
    );
    if (savedTimeline !== null && savedTimeline.currentMatch !== null) {
      let oppLabel = "Adversaire à déterminer";
      if (savedTimeline.opponent !== null) {
        oppLabel = formatPlayersPrimaryName(
          savedTimeline.opponent.player1Name,
          savedTimeline.opponent.player2Name,
        );
      }
      savedOpponentText = `Table ${savedTimeline.currentMatch.tableNumber ?? "–"} · contre ${oppLabel} (${formatQuickPhaseLabel(savedTimeline.currentMatch)})`;
    }
  }

  return (
    <div className="container-home">
      <section className="home-hero-grid" aria-labelledby="home-hero-title">
        <div className="home-hero-copy">
          <span className="eyebrow">
            <SpadeSuitIcon size={12} />
            <span>{activeTitle}</span>
          </span>

          <h1 id="home-hero-title" className="page-title">
            Tournoi de Coinche en direct
          </h1>

          <p className="home-lead">
            Tape simplement ton prénom pour rejoindre ton binôme et voir contre
            qui tu joues. Les matchs de poule se ferment automatiquement après 5
            donnes et les phases finales se créent toutes seules.
          </p>

          {/* Accès express si le joueur s'est déjà identifié */}
          {savedTeam !== null && (
            <div
              className="card-ruled"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 14px",
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
                <div>
                  <span className="eyebrow">
                    <UsersIcon size={12} />
                    <span>Mon binôme actif</span>
                  </span>
                  <div
                    className="font-display"
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      lineHeight: 1.05,
                    }}
                  >
                    {savedTeamPlayers}
                  </div>
                  {savedTeamNick !== null && (
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--accent-terracotta)",
                      }}
                    >
                      « {savedTeamNick} »
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openTeamDirectly(savedTeam.id)}
                >
                  <TableCardsIcon size={16} />
                  <span>Aller à ma table</span>
                  <ArrowRightIcon size={15} />
                </button>
              </div>
              <div
                style={{
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--ink-secondary)",
                }}
              >
                {savedOpponentText}
              </div>
            </div>
          )}

          {/* Formulaire principal : Rejoindre juste avec son PRÉNOM */}
          <form
            className="card-alt home-quick-access"
            onSubmit={handleQuickAccess}
            noValidate
          >
            <label htmlFor="quick-team-input" className="field-label">
              Rejoindre ma table avec mon prénom
            </label>
            <div className="home-quick-row">
              <input
                id="quick-team-input"
                type="text"
                className="field-input"
                placeholder="Tape ton prénom (ex. Angèle, Chahe, Lucas...)"
                value={firstNameQuery}
                onChange={(event) => {
                  setFirstNameQuery(event.target.value);
                  if (formError !== null) {
                    setFormError(null);
                  }
                }}
                maxLength={60}
                autoComplete="given-name"
              />
              <button type="submit" className="btn btn-primary">
                Rejoindre
              </button>
            </div>

            {matchingCandidates.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginTop: "4px",
                }}
                role="listbox"
                aria-label="Joueurs correspondants"
              >
                {matchingCandidates.map((cand) => {
                  const timeline = resolveTeamMatchTimeline(
                    cand.team.id,
                    state.matches,
                    state.teams,
                  );
                  let matchSummary = "Check-in · Tirage des poules à venir";
                  if (timeline.currentMatch !== null) {
                    let oppName = "À déterminer";
                    if (timeline.opponent !== null) {
                      oppName = formatPlayersPrimaryName(
                        timeline.opponent.player1Name,
                        timeline.opponent.player2Name,
                      );
                    }
                    matchSummary = `Table ${timeline.currentMatch.tableNumber ?? "–"} · vs ${oppName} (${formatQuickPhaseLabel(timeline.currentMatch)})`;
                  }

                  return (
                    <button
                      key={cand.team.id}
                      type="button"
                      onClick={() => openTeamDirectly(cand.team.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--border-strong)",
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--ink-primary)",
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="font-display"
                          style={{
                            fontSize: "18px",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            lineHeight: 1.05,
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
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--ink-secondary)",
                            marginTop: "2px",
                          }}
                        >
                          {matchSummary}
                        </div>
                      </div>
                      <ArrowRightIcon
                        size={16}
                        style={{ color: "var(--accent-amber)", flexShrink: 0 }}
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {formError !== null && (
              <p
                role="alert"
                style={{
                  margin: 0,
                  fontSize: "12.5px",
                  fontWeight: 600,
                  color: "var(--status-fail)",
                }}
              >
                {formError}
              </p>
            )}
          </form>

          <div className="home-cta-stack">
            <Link href="/ma-table" className="btn btn-primary">
              <TableCardsIcon size={18} />
              <span>Noter les points (Ma table)</span>
              <ArrowRightIcon size={17} />
            </Link>

            <Link href="/live" className="btn btn-terracotta">
              <ProjectorScreenIcon size={18} />
              <span>Grand écran (/live)</span>
            </Link>

            <Link href="/classement" className="btn btn-secondary">
              <TrophyIcon size={17} />
              <span>Poules &amp; Arbre final</span>
            </Link>

            <Link href="/admin" className="btn btn-secondary">
              <LockIcon size={16} />
              <span>Poste Admin</span>
            </Link>
          </div>
        </div>

        <figure className="poster-frame" style={{ margin: 0 }}>
          <div className="poster-header">
            <span className="poster-label">Affiche de la soirée</span>
            <span className="poster-meta">{activeStart}</span>
          </div>

          <div className="poster-image-wrap">
            <img
              src={activePosterUrl}
              alt="Affiche officielle de la soirée Coinch'Eirb"
              className="poster-image"
            />
          </div>

          <figcaption className="poster-footer">
            <span>Coinch&apos;Eirb · ENSEIRB-MATMECA</span>
            <span className="suits-strip" aria-hidden="true">
              <ClubSuitIcon size={13} />
              <DiamondSuitIcon size={13} style={{ color: "#C8342B" }} />
              <SpadeSuitIcon size={13} />
              <HeartSuitIcon size={13} style={{ color: "#C8342B" }} />
            </span>
          </figcaption>
        </figure>
      </section>

      <section className="home-facts" aria-label="Repères du tournoi">
        <article className="fact-row">
          <span className="fact-icon">
            <ClockIcon size={18} />
          </span>
          <div>
            <h2 className="fact-title">Poules automatiques en 5 donnes</h2>
            <p className="fact-desc">
              Chaque match de poule se ferme tout seul après 5 donnes (+ 6e
              donne si égalité), puis débloque automatiquement la suite.
            </p>
          </div>
        </article>

        <article className="fact-row">
          <span className="fact-icon">
            <TableCardsIcon size={18} />
          </span>
          <div>
            <h2 className="fact-title">1 téléphone par table</h2>
            <p className="fact-desc">
              Saisie directe après chaque donne, mode score final direct et
              annonces manuelles Capot, Générale, Coinche et Surcoinche vers{" "}
              <strong>/live</strong>.
            </p>
          </div>
        </article>

        <article className="fact-row">
          <span className="fact-icon">
            <TrophyIcon size={18} />
          </span>
          <div>
            <h2 className="fact-title">Arbre final généré automatiquement</h2>
            <p className="fact-desc">
              Dès que tous les matchs de poule sont terminés, les Huitièmes (500
              pts), Quarts (600), Demies (700) et Finale (1000) se lancent
              automatiquement.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
