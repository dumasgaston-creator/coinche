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
  LockIcon,
  ProjectorScreenIcon,
  TableCardsIcon,
  TrophyIcon,
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
    return "8e · 500 pts";
  }
  if (match.phase === "quarterfinals") {
    return "Quart · 600 pts";
  }
  if (match.phase === "semifinals") {
    return "Demi · 700 pts";
  }
  return "Finale · 1000 pts";
}

/**
 * Page d'accueil Coinch'Eirb epuree et incarnée :
 * - Hero photographique (vrai hall ENSEIRB + affiche + acces direct par prenom)
 * - Pellicule reelle des soirees Coinch'Eirb & photo des vainqueurs en temps reel
 * - Zero paragraphe bavard.
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
  let activeStart = props.startTimeLabel;
  let activeWinnerPhoto = "/assets/media/vainqueur-precedent.jpg";
  let activeWinnerCaption = "Derniers vainqueurs · Coinch'Eirb";

  if (hydrated) {
    activePosterUrl = state.tournament.posterUrl;
    activeStart = `Départ ${state.tournament.startsAtLabel}`;
    if (state.tournament.winnerPhotoUrl !== undefined) {
      activeWinnerPhoto = state.tournament.winnerPhotoUrl;
    }
    if (state.tournament.winnerPhotoCaption !== undefined) {
      activeWinnerCaption = state.tournament.winnerPhotoCaption;
    }
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
      setFormError("Tape ton prénom.");
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
      setFormError("Clique sur ton binôme ci-dessous.");
      return;
    }

    setFormError(`Prénom introuvable : "${cleaned}".`);
  }

  let savedTeamPlayers = "";
  let savedOpponentText = "";
  if (savedTeam !== null) {
    savedTeamPlayers = formatPlayersPrimaryName(
      savedTeam.player1Name,
      savedTeam.player2Name,
    );
    if (savedTimeline !== null && savedTimeline.currentMatch !== null) {
      let oppLabel = "À déterminer";
      if (savedTimeline.opponent !== null) {
        oppLabel = formatPlayersPrimaryName(
          savedTimeline.opponent.player1Name,
          savedTimeline.opponent.player2Name,
        );
      }
      savedOpponentText = `Table ${savedTimeline.currentMatch.tableNumber ?? "–"} · vs ${oppLabel}`;
    }
  }

  return (
    <div className="container-home">
      {/* HERO ÉDITORIAL PHOTOGRAPHIQUE */}
      <section className="home-editorial-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-bg-wrap" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/media/soiree-atrium-nuit.jpg"
            alt=""
            className="home-hero-bg-img"
          />
          <div className="home-hero-bg-scrim" />
        </div>

        <div className="home-editorial-inner">
          <div className="home-editorial-left">
            <div className="home-brand-stamp">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/media/logo-abeilles.jpg"
                alt="Logo Coinch'Eirb"
                className="home-brand-crest"
              />
              <span className="home-brand-kicker">
                ENSEIRB-MATMECA · {activeStart}
              </span>
            </div>

            <h1 id="home-hero-title" className="home-editorial-title">
              COINCH&apos;EIRB
            </h1>

            {savedTeam !== null && (
              <button
                type="button"
                className="home-resume-strip"
                onClick={() => openTeamDirectly(savedTeam.id)}
              >
                <div style={{ minWidth: 0, textAlign: "left" }}>
                  <span className="home-resume-label">Reprendre ma table</span>
                  <strong className="home-resume-players">
                    {savedTeamPlayers}
                  </strong>
                  {savedOpponentText.length > 0 && (
                    <span className="home-resume-sub">{savedOpponentText}</span>
                  )}
                </div>
                <ArrowRightIcon size={18} />
              </button>
            )}

            <form
              className="home-firstname-form"
              onSubmit={handleQuickAccess}
              noValidate
            >
              <label htmlFor="quick-team-input" className="home-firstname-label">
                Tape ton prénom pour jouer
              </label>
              <div className="home-quick-row">
                <input
                  id="quick-team-input"
                  type="text"
                  className="home-firstname-input"
                  placeholder="Ex. Angèle, Chahe, Lucas..."
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
                  Go
                </button>
              </div>

              {matchingCandidates.length > 0 && (
                <div className="home-suggestions-list" role="listbox">
                  {matchingCandidates.map((cand) => {
                    const timeline = resolveTeamMatchTimeline(
                      cand.team.id,
                      state.matches,
                      state.teams,
                    );
                    let matchSummary = "En attente du tirage";
                    if (timeline.currentMatch !== null) {
                      let oppName = "À déterminer";
                      if (timeline.opponent !== null) {
                        oppName = formatPlayersPrimaryName(
                          timeline.opponent.player1Name,
                          timeline.opponent.player2Name,
                        );
                      }
                      matchSummary = `T${timeline.currentMatch.tableNumber ?? "–"} · vs ${oppName} (${formatQuickPhaseLabel(timeline.currentMatch)})`;
                    }

                    return (
                      <button
                        key={cand.team.id}
                        type="button"
                        className="home-suggestion-item"
                        onClick={() => openTeamDirectly(cand.team.id)}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div className="home-suggestion-players">
                            {cand.playersPrimary}
                          </div>
                          {cand.nickname !== null && (
                            <div className="home-suggestion-nick">
                              « {cand.nickname} »
                            </div>
                          )}
                          <div className="home-suggestion-meta">
                            {matchSummary}
                          </div>
                        </div>
                        <ArrowRightIcon size={16} />
                      </button>
                    );
                  })}
                </div>
              )}

              {formError !== null && (
                <p className="home-firstname-error" role="alert">
                  {formError}
                </p>
              )}
            </form>

            <nav className="home-minimal-links" aria-label="Accès rapides">
              <Link href="/ma-table" className="home-nav-primary">
                <TableCardsIcon size={16} />
                <span>Ma table</span>
              </Link>
              <Link href="/jouer" className="home-nav-ghost">
                <span>Partie libre (BAR)</span>
              </Link>
              <Link href="/memes" className="home-nav-ghost">
                <span>Boîte à Memes</span>
              </Link>
              <Link href="/classement" className="home-nav-ghost">
                <TrophyIcon size={15} />
                <span>Poules &amp; Arbre</span>
              </Link>
              <Link href="/live" className="home-nav-ghost">
                <ProjectorScreenIcon size={15} />
                <span>Projecteur /live</span>
              </Link>
              <Link href="/admin" className="home-nav-ghost">
                <LockIcon size={14} />
                <span>Admin</span>
              </Link>
            </nav>
          </div>

          <figure className="home-poster-card">
            <div className="home-poster-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePosterUrl}
                alt="Affiche de la soirée Coinch'Eirb"
                className="home-poster-img"
              />
            </div>
          </figure>
        </div>
      </section>

      {/* PELLICULE PHOTOS RÉELLES & VAINQUEURS */}
      <section className="home-photo-wall" aria-label="Ambiance et vainqueurs">
        <figure className="home-photo-tile home-photo-winner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeWinnerPhoto}
            alt={activeWinnerCaption}
            className="home-photo-img"
          />
          <figcaption className="home-photo-cap">
            <TrophyIcon size={14} />
            <span>{activeWinnerCaption}</span>
          </figcaption>
        </figure>

        <figure className="home-photo-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/media/soiree-foyer-bar.jpg"
            alt="Soirée coinche au BAR de l'ENSEIRB-MATMECA"
            className="home-photo-img"
          />
          <figcaption className="home-photo-cap">
            <span>Au BAR</span>
          </figcaption>
        </figure>

        <figure className="home-photo-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/media/soiree-table-cartes.jpg"
            alt="Table en jeu durant le tournoi Coinch'Eirb"
            className="home-photo-img"
          />
          <figcaption className="home-photo-cap">
            <span>5 donnes · Sans pitié</span>
          </figcaption>
        </figure>

        <figure className="home-photo-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/media/meme-voulez-vous-coincher.jpg"
            alt="Voulez-vous coincher avec moi ce soir"
            className="home-photo-img"
          />
          <figcaption className="home-photo-cap">
            <span>Voulez-vous coincher ?</span>
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
