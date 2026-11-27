"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ClubAccountGateCard } from "@/components/auth/ClubAccountGateCard";
import { ShareWebsiteBanner } from "@/components/layout/ShareWebsiteBanner";
import { ClashRoyaleSoundboardBar } from "@/components/live/ClashRoyaleSoundboardBar";
import {
  playBuiltinSoundPreset,
  playMatchOutcomeSound,
} from "@/components/live/sound-engine";
import { PartnerDiscoveryAndAddCard } from "@/components/players/PartnerDiscoveryAndAddCard";
import { useClubAccount } from "@/lib/auth/use-club-account";
import {
  addDealToCasualGameInStore,
  collectKnownSchoolPlayers,
  deleteCasualGameFromStore,
  finishCasualGameInStore,
  getCasualGamesForPlayer,
  startCasualGame,
  undoLastDealInCasualGameStore,
  type CasualGameRecord,
  type CasualSpecialTag,
} from "@/lib/casual/casual-store";
import { useCasualGamesStore } from "@/lib/casual/use-casual-store";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import {
  CheckIcon,
  SpadeSuitIcon,
  TableCardsIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons/Icons";

const QUICK_DEAL_PTS: readonly number[] = [80, 90, 100, 110, 120, 160, 250, 320];

const TARGET_OPTIONS: ReadonlyArray<{ label: string; value: number | null }> = [
  { label: "500", value: 500 },
  { label: "1000", value: 1000 },
  { label: "1500", value: 1500 },
  { label: "Libre", value: null },
];

const SPECIAL_TAGS: ReadonlyArray<{
  id: Exclude<CasualSpecialTag, null>;
  label: string;
}> = [
  { id: "capot", label: "Capot" },
  { id: "generale", label: "Générale" },
  { id: "coinche", label: "Coinche" },
  { id: "surcoinche", label: "Surcoinche" },
  { id: "parlante", label: "Parlante +160" },
];

function formatDateShort(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} · ${hh}h${mm}`;
  } catch {
    return "Aujourd'hui";
  }
}

export function PartieLibreView() {
  const { state: tournamentState } = useTournamentStore();
  const { games, directory } = useCasualGamesStore();
  const { account } = useClubAccount();

  const [playerA1, setPlayerA1] = useState<string>("");
  const [playerA2, setPlayerA2] = useState<string>("");
  const [playerB1, setPlayerB1] = useState<string>("");
  const [playerB2, setPlayerB2] = useState<string>("");
  const [targetScore, setTargetScore] = useState<number | null>(1000);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [ptsA, setPtsA] = useState<string>("");
  const [ptsB, setPtsB] = useState<string>("");
  const [quickSide, setQuickSide] = useState<"a" | "b">("a");
  const [specialTag, setSpecialTag] = useState<CasualSpecialTag>(null);
  const [dealError, setDealError] = useState<string | null>(null);

  const [historySearch, setHistorySearch] = useState<string>("");

  // Pre-remplit automatiquement Joueur 1 avec le prenom du joueur connecte
  // et lit les parametres d'invitation (?partenaire=..., ?adv1=..., ?adv2=...)
  useEffect(() => {
    if (account !== null && playerA1.trim().length === 0) {
      setPlayerA1(account.firstName);
    }
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const pInvite = params.get("partenaire");
        const adv1 = params.get("adv1");
        const adv2 = params.get("adv2");
        if (pInvite !== null && pInvite.trim().length > 0 && playerA2 === "") {
          setPlayerA2(pInvite.trim());
        }
        if (adv1 !== null && adv1.trim().length > 0 && playerB1 === "") {
          setPlayerB1(adv1.trim());
        }
        if (adv2 !== null && adv2.trim().length > 0 && playerB2 === "") {
          setPlayerB2(adv2.trim());
        }
      } catch {
        // Ignore
      }
    }
  }, [account, playerA1, playerA2, playerB1, playerB2]);

  const knownPlayers = useMemo(
    () => collectKnownSchoolPlayers(tournamentState, games, directory),
    [tournamentState, games, directory],
  );

  const inProgressGames = useMemo(
    () => games.filter((g) => g.status === "in_progress"),
    [games],
  );

  let activeGame: CasualGameRecord | null = null;
  if (activeGameId !== null) {
    activeGame = games.find((g) => g.id === activeGameId) ?? null;
  }
  if (activeGame === null && inProgressGames[0] !== undefined) {
    activeGame = inProgressGames[0];
  }

  const filteredHistory = useMemo(
    () => getCasualGamesForPlayer(games, historySearch),
    [games, historySearch],
  );

  function handleStartGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSetupError(null);
    try {
      const created = startCasualGame({
        playerA1,
        playerA2,
        playerB1,
        playerB2,
        targetScore,
        locationLabel: "Au BAR",
      });
      setActiveGameId(created.id);
      setPlayerA2("");
      setPlayerB1("");
      setPlayerB2("");
      playBuiltinSoundPreset("hog_rider");
    } catch (err) {
      let msg = "Vérifiez les 4 noms de joueurs.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setSetupError(msg);
    }
  }

  function handleAddDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeGame === null) {
      return;
    }
    setDealError(null);

    const parsedA = Number.parseInt(ptsA.trim() || "0", 10);
    const parsedB = Number.parseInt(ptsB.trim() || "0", 10);
    if (
      Number.isNaN(parsedA) ||
      Number.isNaN(parsedB) ||
      parsedA < 0 ||
      parsedB < 0
    ) {
      setDealError("Points invalides.");
      return;
    }
    if (parsedA === 0 && parsedB === 0) {
      setDealError("Ajoutez les points d'au moins une équipe.");
      return;
    }

    const updatedGames = addDealToCasualGameInStore({
      gameId: activeGame.id,
      pointsTeamA: parsedA,
      pointsTeamB: parsedB,
      specialTag,
    });

    const refreshed = updatedGames.find((g) => g.id === activeGame?.id);
    if (refreshed !== undefined && refreshed.status === "completed") {
      if (refreshed.winnerSide === "team_a") {
        playMatchOutcomeSound("win");
      } else {
        playMatchOutcomeSound("lose");
      }
    } else if (parsedA > parsedB) {
      if (specialTag === "capot" || specialTag === "generale") {
        playMatchOutcomeSound("win");
      }
    } else if (parsedB > parsedA) {
      if (parsedA === 0 && parsedB >= 160) {
        playMatchOutcomeSound("lose");
      }
    }

    setPtsA("");
    setPtsB("");
    setSpecialTag(null);
  }

  function handleQuickChip(val: number) {
    if (quickSide === "a") {
      setPtsA(String(val));
      if (ptsB === "") {
        setPtsB("0");
      }
    } else {
      setPtsB(String(val));
      if (ptsA === "") {
        setPtsA("0");
      }
    }
  }

  let activeTargetLabel = "Partie libre";
  if (activeGame !== null && activeGame.targetScore !== null) {
    activeTargetLabel = `Objectif ${activeGame.targetScore} pts`;
  }

  return (
    <div className="jouer-shell">
      <header className="jouer-hero">
        <div>
          <span className="eyebrow" style={{ color: "#e8a628" }}>
            <SpadeSuitIcon size={12} />
            <span>Toute l&apos;année · Au BAR ENSEIRB</span>
          </span>
          <h1 className="jouer-title">Partie Libre &amp; Duos</h1>
        </div>
        <Link href="/classement" className="btn btn-sm btn-primary">
          <TrophyIcon size={15} />
          <span>Classements Individuel &amp; Équipe</span>
        </Link>
      </header>

      <datalist id="enseirb-players-list">
        {knownPlayers.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* PARTIE EN COURS */}
      {activeGame !== null && (
        <section className="scoreboard-card" aria-label="Score partie libre">
          <div className="scoreboard-meta">
            <span>
              {activeGame.locationLabel} · {activeTargetLabel}
            </span>
            <span className="tabular-nums">
              {activeGame.deals.length} donne(s)
            </span>
          </div>

          <div className="scoreboard-columns">
            <div
              className="scoreboard-team"
              data-leading={String(activeGame.scoreA > activeGame.scoreB)}
            >
              <h2 className="scoreboard-team-name">
                {activeGame.teamA[0]} / {activeGame.teamA[1]}
              </h2>
              <div className="scoreboard-points">{activeGame.scoreA}</div>
            </div>

            <div
              className="scoreboard-team"
              data-leading={String(activeGame.scoreB > activeGame.scoreA)}
            >
              <h2 className="scoreboard-team-name">
                {activeGame.teamB[0]} / {activeGame.teamB[1]}
              </h2>
              <div className="scoreboard-points">{activeGame.scoreB}</div>
            </div>
          </div>

          {activeGame.status === "completed" && (
            <div
              className="banner banner-pass"
              style={{
                marginTop: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <TrophyIcon size={16} />
                <span>
                  Partie terminée ! Les classements Individuel &amp; Équipe
                  ENSEIRB sont mis à jour.
                </span>
              </div>
              <div style={{ display: "inline-flex", gap: "6px" }}>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => playMatchOutcomeSound("win")}
                >
                  Roi HEHEHEHA !
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => playMatchOutcomeSound("lose")}
                >
                  FAAAAHHH !
                </button>
              </div>
            </div>
          )}

          {activeGame.status === "in_progress" && (
            <form
              onSubmit={handleAddDeal}
              style={{
                marginTop: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
              noValidate
            >
              <div className="score-inputs-grid">
                <div>
                  <label htmlFor="casual-pts-a" className="field-label">
                    {activeGame.teamA[0]} / {activeGame.teamA[1]}
                  </label>
                  <input
                    id="casual-pts-a"
                    type="text"
                    inputMode="numeric"
                    className="field-input field-input-score"
                    placeholder="0"
                    value={ptsA}
                    onFocus={() => setQuickSide("a")}
                    onChange={(e) => setPtsA(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="casual-pts-b" className="field-label">
                    {activeGame.teamB[0]} / {activeGame.teamB[1]}
                  </label>
                  <input
                    id="casual-pts-b"
                    type="text"
                    inputMode="numeric"
                    className="field-input field-input-score"
                    placeholder="0"
                    value={ptsB}
                    onFocus={() => setQuickSide("b")}
                    onChange={(e) => setPtsB(e.target.value)}
                  />
                </div>
              </div>

              <div className="quick-chips">
                {QUICK_DEAL_PTS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    className="chip-btn"
                    onClick={() => handleQuickChip(val)}
                  >
                    +{val}
                  </button>
                ))}
              </div>

              <div className="jouer-tag-pills">
                {SPECIAL_TAGS.map((tag) => {
                  const isActive = specialTag === tag.id;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className="jouer-tag-pill"
                      data-active={String(isActive)}
                      onClick={() => {
                        if (isActive) {
                          setSpecialTag(null);
                        } else {
                          setSpecialTag(tag.id);
                        }
                      }}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>

              {dealError !== null && (
                <div className="banner banner-fail">{dealError}</div>
              )}

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <CheckIcon size={16} />
                  <span>Valider la donne</span>
                </button>
                {activeGame.deals.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (activeGame !== null) {
                        undoLastDealInCasualGameStore(activeGame.id);
                      }
                    }}
                  >
                    Annuler dernière
                  </button>
                )}
                {activeGame.scoreA !== activeGame.scoreB && (
                  <button
                    type="button"
                    className="btn btn-pass btn-sm"
                    onClick={() => {
                      if (activeGame !== null) {
                        const wonA = activeGame.scoreA > activeGame.scoreB;
                        finishCasualGameInStore({ gameId: activeGame.id });
                        if (wonA) {
                          playMatchOutcomeSound("win");
                        } else {
                          playMatchOutcomeSound("lose");
                        }
                      }
                    }}
                  >
                    Clore partie
                  </button>
                )}
              </div>
            </form>
          )}

          {activeGame.status === "completed" && (
            <div
              style={{
                marginTop: "10px",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  const created = startCasualGame({
                    playerA1: activeGame.teamA[0],
                    playerA2: activeGame.teamA[1],
                    playerB1: activeGame.teamB[0],
                    playerB2: activeGame.teamB[1],
                    targetScore: activeGame.targetScore,
                    locationLabel: "Au BAR",
                  });
                  setActiveGameId(created.id);
                }}
              >
                Revanche (mêmes équipes)
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const created = startCasualGame({
                    playerA1: activeGame.teamA[0],
                    playerA2: activeGame.teamB[0],
                    playerB1: activeGame.teamA[1],
                    playerB2: activeGame.teamB[1],
                    targetScore: activeGame.targetScore,
                    locationLabel: "Au BAR",
                  });
                  setActiveGameId(created.id);
                }}
              >
                Inverser partenaires
              </button>
            </div>
          )}
        </section>
      )}

      <ClubAccountGateCard
        title="Connecte-toi pour ajouter tes partenaires et certifier tes victoires"
        compact
      />

      {/* MODULE CONNAÎTRE LA PERSONNE AVEC QUI ON JOUE & L'AJOUTER MÊME SI ON N'EST PAS ELLE */}
      <PartnerDiscoveryAndAddCard
        tournamentState={tournamentState}
        casualGames={games}
        directory={directory}
        selectedPartnerName={playerA2}
        myPlayerName={playerA1}
        onPartnerReady={(info) => {
          setPlayerA2(info.partnerName);
          if (info.myName !== null && playerA1.trim().length === 0) {
            setPlayerA1(info.myName);
          }
        }}
      />

      {/* SOUNDBOARD CLASH ROYALE & FAAAAHHH */}
      <ClashRoyaleSoundboardBar compact />

      {/* LIEN CLIQUABLE & INVITATION PARTENAIRE */}
      <ShareWebsiteBanner compact />

      {/* NOUVELLE PARTIE AU BAR */}
      <section className="card-ruled" aria-labelledby="new-casual-heading">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginBottom: "10px",
          }}
        >
          <h2 id="new-casual-heading" className="section-title">
            Nouvelle partie au BAR
          </h2>
          <span className="badge badge-neutral">
            <UsersIcon size={12} />
            <span>{knownPlayers.length} joueur(s) connus</span>
          </span>
        </div>

        <form
          onSubmit={handleStartGame}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          noValidate
        >
          <div className="jouer-teams-grid">
            <div className="jouer-side-card" data-side="a">
              <strong style={{ fontSize: "12px", textTransform: "uppercase" }}>
                Ton équipe
              </strong>
              <input
                type="text"
                list="enseirb-players-list"
                className="field-input"
                placeholder="Toi (Prénom / Pseudo)"
                value={playerA1}
                onChange={(e) => setPlayerA1(e.target.value)}
              />
              <input
                type="text"
                list="enseirb-players-list"
                className="field-input"
                placeholder="Ton partenaire (tape ou ajoute ci-dessus)"
                value={playerA2}
                onChange={(e) => setPlayerA2(e.target.value)}
              />
            </div>

            <div className="jouer-side-card" data-side="b">
              <strong style={{ fontSize: "12px", textTransform: "uppercase" }}>
                Adversaires
              </strong>
              <input
                type="text"
                list="enseirb-players-list"
                className="field-input"
                placeholder="Adversaire 1"
                value={playerB1}
                onChange={(e) => setPlayerB1(e.target.value)}
              />
              <input
                type="text"
                list="enseirb-players-list"
                className="field-input"
                placeholder="Adversaire 2"
                value={playerB2}
                onChange={(e) => setPlayerB2(e.target.value)}
              />
            </div>
          </div>

          <div>
            <span className="field-label">Objectif de points</span>
            <div className="jouer-target-row">
              {TARGET_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className="jouer-target-btn"
                  data-active={String(targetScore === opt.value)}
                  onClick={() => setTargetScore(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {setupError !== null && (
            <div className="banner banner-fail">{setupError}</div>
          )}

          <button type="submit" className="btn btn-primary btn-full">
            <TableCardsIcon size={17} />
            <span>Lancer la partie</span>
          </button>
        </form>
      </section>

      {/* HISTORIQUE MUTUEL DES PARTIES AU BAR */}
      <section className="card" aria-labelledby="casual-history-heading">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <h2 id="casual-history-heading" className="section-title">
            Historique au BAR ({filteredHistory.length})
          </h2>
          <input
            type="search"
            className="field-input"
            style={{ maxWidth: "220px", minHeight: "38px", fontSize: "13px" }}
            placeholder="Filtrer par prénom..."
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />
        </div>

        {filteredHistory.length === 0 && (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--ink-secondary)",
            }}
          >
            Aucune partie enregistrée pour le moment. L&apos;application démarre
            à zéro et se construit petit à petit avec vos vrais noms !
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredHistory.map((g) => {
            const winA = g.winnerSide === "team_a";
            const winB = g.winnerSide === "team_b";
            return (
              <article key={g.id} className="jouer-history-card">
                <div className="jouer-history-top">
                  <span>
                    {g.locationLabel} · {formatDateShort(g.createdAt)}
                  </span>
                  <div style={{ display: "inline-flex", gap: "6px" }}>
                    {g.status === "in_progress" && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        style={{ minHeight: "26px", padding: "0 8px" }}
                        onClick={() => setActiveGameId(g.id)}
                      >
                        Reprendre
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      style={{ minHeight: "26px", padding: "0 6px" }}
                      aria-label="Supprimer cette partie"
                      onClick={() => deleteCasualGameFromStore(g.id)}
                    >
                      <XIcon size={13} />
                    </button>
                  </div>
                </div>

                <div className="jouer-history-match">
                  <span className="jouer-history-side" data-winner={String(winA)}>
                    {g.teamA[0]} / {g.teamA[1]}
                  </span>
                  <span className="jouer-history-score">
                    {g.scoreA} – {g.scoreB}
                  </span>
                  <span
                    className="jouer-history-side"
                    data-winner={String(winB)}
                    style={{ textAlign: "right" }}
                  >
                    {g.teamB[0]} / {g.teamB[1]}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
