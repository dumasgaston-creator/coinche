"use client";

import type { MatchPhase } from "@/types/database";
import type { LiveBracketMatchView } from "@/components/live/types";
import { CheckIcon, SpadeSuitIcon, TrophyIcon } from "@/components/icons/Icons";

interface BracketViewProps {
  matches: LiveBracketMatchView[];
  posterUrl?: string;
  tournamentTitle?: string;
}

interface BracketColumnMeta {
  phase: Exclude<MatchPhase, "pool">;
  label: string;
  targetLabel: string;
}

const BRACKET_COLUMNS: readonly BracketColumnMeta[] = [
  { phase: "round_of_16", label: "Huitièmes", targetLabel: "500 pts" },
  { phase: "quarterfinals", label: "Quarts", targetLabel: "600 pts" },
  { phase: "semifinals", label: "Demi-finales", targetLabel: "700 pts" },
  { phase: "final", label: "Grande Finale", targetLabel: "1000 pts" },
];

function formatScoreCell(
  match: LiveBracketMatchView,
  side: "a" | "b",
): string {
  if (match.status === "bye") {
    if (side === "a" && match.winnerTeamId === match.node.teamAId) {
      return "Exempt";
    }
    if (side === "b" && match.winnerTeamId === match.node.teamBId) {
      return "Exempt";
    }
    return "–";
  }
  if (
    match.status === "pending" &&
    match.scoreTeamA === 0 &&
    match.scoreTeamB === 0
  ) {
    return "–";
  }
  if (side === "a") {
    return String(match.scoreTeamA);
  }
  return String(match.scoreTeamB);
}

function groupMatchesIntoPairs(
  matches: LiveBracketMatchView[],
): LiveBracketMatchView[][] {
  const pairs: LiveBracketMatchView[][] = [];
  for (let i = 0; i < matches.length; i += 2) {
    const first = matches[i];
    const second = matches[i + 1];
    if (first !== undefined && second !== undefined) {
      pairs.push([first, second]);
    } else if (first !== undefined) {
      pairs.push([first]);
    }
  }
  return pairs;
}

/**
 * Vue 4 : Arbre final moderne sur fond d'affiche de soirée contrastée.
 * Connecteurs géométriques dorés (Huitièmes 500 -> Quarts 600 -> Demies 700 -> Grande Finale 1000),
 * noms des joueurs mis en avant et surnom facultatif en petit.
 */
export function BracketView(props: BracketViewProps) {
  if (props.matches.length === 0) {
    return (
      <section className="live-empty-panel">
        <p>
          L&apos;arbre de phase finale apparaîtra dès la fin de la composition
          des poules.
        </p>
      </section>
    );
  }

  let resolvedPosterUrl = "/assets/affiche-soiree.jpg";
  if (
    props.posterUrl !== undefined &&
    props.posterUrl.trim().length > 0
  ) {
    resolvedPosterUrl = props.posterUrl.trim();
  }

  const columnsWithMatches = BRACKET_COLUMNS.map((col) => {
    const colMatches = props.matches
      .filter((m) => m.node.phase === col.phase)
      .sort((a, b) => a.node.bracketSlot - b.node.bracketSlot);
    return {
      meta: col,
      matches: colMatches,
    };
  }).filter((entry) => entry.matches.length > 0);

  const finalMatch = props.matches.find((m) => m.node.phase === "final");
  let championPlayers: string | null = null;
  let championNick: string | null = null;
  let championScoreText: string | null = null;

  if (
    finalMatch !== undefined &&
    finalMatch.winnerTeamId !== null &&
    (finalMatch.status === "completed" || finalMatch.status === "forfeit")
  ) {
    if (finalMatch.winnerTeamId === finalMatch.node.teamAId) {
      championPlayers = finalMatch.teamAPlayers ?? finalMatch.teamAName;
      championNick = finalMatch.teamANickname ?? null;
      championScoreText = `${finalMatch.scoreTeamA} – ${finalMatch.scoreTeamB}`;
    } else if (finalMatch.winnerTeamId === finalMatch.node.teamBId) {
      championPlayers = finalMatch.teamBPlayers ?? finalMatch.teamBName;
      championNick = finalMatch.teamBNickname ?? null;
      championScoreText = `${finalMatch.scoreTeamB} – ${finalMatch.scoreTeamA}`;
    }
  }

  return (
    <section
      className="live-view-section live-bracket-showcase"
      aria-label="Arbre de la phase finale"
    >
      {/* Affiche de la soirée en fond contrasté moderne */}
      <div className="live-bracket-backdrop" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedPosterUrl}
          alt=""
          className="live-bracket-poster-bg"
        />
        <div className="live-bracket-scrim" />
      </div>

      <div className="live-bracket-content">
        <div className="live-bracket-topstrip">
          <div className="live-bracket-topstrip-left">
            <SpadeSuitIcon size={15} className="suit-amber" />
            <span>Tableau à élimination directe · Vainqueurs par joueurs</span>
          </div>
          <span className="live-bracket-topstrip-badge">
            500 · 600 · 700 · 1000 PTS
          </span>
        </div>

        <div
          className="live-bracket-board"
          style={{
            gridTemplateColumns: `repeat(${columnsWithMatches.length}, minmax(0, 1fr))`,
          }}
        >
          {columnsWithMatches.map((col, colIdx) => {
            const isFinalCol = col.meta.phase === "final";
            const isLastCol = colIdx === columnsWithMatches.length - 1;
            const pairs = groupMatchesIntoPairs(col.matches);

            return (
              <div
                key={col.meta.phase}
                className="live-bracket-col"
                data-final={String(isFinalCol)}
              >
                <header className="live-bracket-col-head">
                  <div className="live-bracket-col-title-row">
                    {isFinalCol && (
                      <TrophyIcon size={17} className="suit-amber" />
                    )}
                    <h2 className="live-bracket-col-title">{col.meta.label}</h2>
                  </div>
                  <span className="live-bracket-target tabular-nums">
                    {col.meta.targetLabel}
                  </span>
                </header>

                <div className="live-bracket-slots">
                  {pairs.map((pair, pairIdx) => {
                    let hasFork = "false";
                    if (!isLastCol && pair.length === 2) {
                      hasFork = "true";
                    }
                    let hasSingleStem = "false";
                    if (!isLastCol && pair.length === 1) {
                      hasSingleStem = "true";
                    }

                    return (
                      <div
                        key={`${col.meta.phase}-pair-${pairIdx}`}
                        className="live-bracket-pair"
                        data-fork={hasFork}
                        data-stem={hasSingleStem}
                      >
                        {pair.map((match) => {
                          const isTeamAWinner =
                            match.winnerTeamId !== null &&
                            match.winnerTeamId === match.node.teamAId;
                          const isTeamBWinner =
                            match.winnerTeamId !== null &&
                            match.winnerTeamId === match.node.teamBId;

                          const teamAPrimary =
                            match.teamAPlayers ?? match.teamAName;
                          const teamANick = match.teamANickname ?? null;
                          const teamBPrimary =
                            match.teamBPlayers ?? match.teamBName;
                          const teamBNick = match.teamBNickname ?? null;

                          let tableMetaText = `Cible ${match.node.targetScore} pts`;
                          if (match.node.tableNumber !== null) {
                            tableMetaText = `Table ${match.node.tableNumber} · ${match.node.targetScore} pts`;
                          }

                          let statusTag = "";
                          if (match.status === "in_progress") {
                            statusTag = "EN JEU";
                          } else if (
                            match.status === "completed" ||
                            match.status === "forfeit"
                          ) {
                            statusTag = "VALIDÉ";
                          }

                          return (
                            <div
                              key={match.node.tempId}
                              className="live-bracket-match-wrap"
                            >
                              <article
                                className="live-bracket-card"
                                data-final={String(isFinalCol)}
                                data-status={match.status}
                              >
                                <div className="live-bracket-card-meta">
                                  <span className="tabular-nums">
                                    {tableMetaText}
                                  </span>
                                  {statusTag.length > 0 && (
                                    <span
                                      className="live-bracket-status-chip"
                                      data-status={match.status}
                                    >
                                      {statusTag}
                                    </span>
                                  )}
                                </div>

                                <div
                                  className="live-bracket-team-line"
                                  data-winner={String(isTeamAWinner)}
                                >
                                  <div className="live-bracket-team-label">
                                    {match.node.seedA !== null && (
                                      <span className="live-seed-tag tabular-nums">
                                        #{match.node.seedA}
                                      </span>
                                    )}
                                    <div className="live-bracket-team-stack">
                                      <span className="live-bracket-team-name">
                                        {teamAPrimary}
                                      </span>
                                      {teamANick !== null && (
                                        <span className="live-bracket-team-nick">
                                          {teamANick}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="live-bracket-score-wrap">
                                    {isTeamAWinner && (
                                      <CheckIcon
                                        size={13}
                                        className="live-winner-check"
                                      />
                                    )}
                                    <span className="live-bracket-team-score tabular-nums">
                                      {formatScoreCell(match, "a")}
                                    </span>
                                  </div>
                                </div>

                                <div
                                  className="live-bracket-team-line"
                                  data-winner={String(isTeamBWinner)}
                                >
                                  <div className="live-bracket-team-label">
                                    {match.node.seedB !== null && (
                                      <span className="live-seed-tag tabular-nums">
                                        #{match.node.seedB}
                                      </span>
                                    )}
                                    <div className="live-bracket-team-stack">
                                      <span className="live-bracket-team-name">
                                        {teamBPrimary}
                                      </span>
                                      {teamBNick !== null && (
                                        <span className="live-bracket-team-nick">
                                          {teamBNick}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="live-bracket-score-wrap">
                                    {isTeamBWinner && (
                                      <CheckIcon
                                        size={13}
                                        className="live-winner-check"
                                      />
                                    )}
                                    <span className="live-bracket-team-score tabular-nums">
                                      {formatScoreCell(match, "b")}
                                    </span>
                                  </div>
                                </div>
                              </article>

                              {isFinalCol && championPlayers !== null && (
                                <div className="live-champion-banner">
                                  <span className="live-champion-eyebrow">
                                    <TrophyIcon size={14} />
                                    <span>Vainqueurs de la soirée</span>
                                  </span>
                                  <strong className="live-champion-players">
                                    {championPlayers}
                                  </strong>
                                  {championNick !== null && (
                                    <span className="live-champion-nick">
                                      {championNick}
                                    </span>
                                  )}
                                  {championScoreText !== null && (
                                    <span className="live-champion-score tabular-nums">
                                      Finale · {championScoreText}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
