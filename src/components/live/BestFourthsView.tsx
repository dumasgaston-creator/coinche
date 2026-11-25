"use client";

import type { QualifiedTeamSeed } from "@/lib/tournament/types";
import type { LiveTeamDisplayInfo } from "@/components/live/types";
import { CheckIcon, TrophyIcon } from "@/components/icons/Icons";

interface BestFourthsViewProps {
  candidates: QualifiedTeamSeed[];
  wildcardSlotsAvailable: number;
  wildcardRank?: number | null;
  directTopRank?: number;
  teamDisplayById?: Record<string, LiveTeamDisplayInfo>;
}

function formatSignedDiff(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

/**
 * Vue 2 : Course aux Meilleurs 4es.
 * Met en evidence le goal-average (points marques) et la force de la poule (`poolTotalPoints`)
 * qui departage automatiquement toute egalite parfaite.
 */
export function BestFourthsView(props: BestFourthsViewProps) {
  const wildcardRankNum = props.wildcardRank ?? 4;
  const directTop = props.directTopRank ?? 3;

  if (props.candidates.length === 0) {
    return (
      <section className="live-empty-panel">
        <p>
          Qualification directe par poule (aucun repêchage de meilleurs{" "}
          {wildcardRankNum}es nécessaire pour cet effectif).
        </p>
      </section>
    );
  }

  const leader = props.candidates[0];
  let leaderPrimary = "";
  let leaderNick: string | null = null;
  if (leader !== undefined) {
    const info = props.teamDisplayById?.[leader.teamId];
    if (info !== undefined) {
      leaderPrimary = info.players;
      leaderNick = info.nickname;
    } else {
      leaderPrimary = leader.teamName;
    }
  }

  return (
    <section
      className="live-view-section live-fourths-layout"
      aria-label="Course aux meilleurs quatrièmes"
    >
      <div className="live-rule-banner">
        <div className="live-rule-banner-left">
          <span className="live-rule-eyebrow">
            Top {directTop} par poule + {props.wildcardSlotsAvailable} meilleur(s) {wildcardRankNum}e(s)
          </span>
          <p className="live-rule-text">
            Départage : victoires · points marqués · force de la poule.
          </p>
        </div>

        {leader !== undefined && (
          <div className="live-leader-callout">
            <span className="live-leader-tag">
              <TrophyIcon size={15} />
              <span>Meilleur {wildcardRankNum}e en tête</span>
            </span>
            <strong className="live-leader-name">{leaderPrimary}</strong>
            {leaderNick !== null && (
              <span className="live-leader-nick">{leaderNick}</span>
            )}
            <span className="live-leader-meta tabular-nums">
              {leader.poolLabel} · {leader.pointsScored} pts marqués · Poule à{" "}
              {leader.poolTotalPoints} pts
            </span>
          </div>
        )}
      </div>

      <div className="live-fourths-table-card">
        <table className="live-fourths-table">
          <thead>
            <tr>
              <th scope="col">Rang {wildcardRankNum}es</th>
              <th scope="col">Joueurs</th>
              <th scope="col">Poule d&apos;origine</th>
              <th scope="col" className="num">
                Victoires
              </th>
              <th scope="col" className="num">
                Goal-average (Pts marqués)
              </th>
              <th scope="col" className="num">
                Force de la poule
              </th>
              <th scope="col" className="num">
                Différence
              </th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {props.candidates.map((team, idx) => {
              const rank = idx + 1;
              let rowVariant = "eliminated";
              let verdictText = "Éliminé";
              if (team.qualified) {
                rowVariant = "qualified";
                verdictText = "Qualifié en 8es";
              }

              // Detecte une egalite stricte de victoires et points marques avec le voisin
              const prevTeam = props.candidates[idx - 1];
              const nextTeam = props.candidates[idx + 1];
              let hasTieOnScore = false;
              if (
                prevTeam !== undefined &&
                prevTeam.matchesWon === team.matchesWon &&
                prevTeam.pointsScored === team.pointsScored
              ) {
                hasTieOnScore = true;
              }
              if (
                nextTeam !== undefined &&
                nextTeam.matchesWon === team.matchesWon &&
                nextTeam.pointsScored === team.pointsScored
              ) {
                hasTieOnScore = true;
              }

              const info = props.teamDisplayById?.[team.teamId];
              let primaryLabel = team.teamName;
              let smallNick: string | null = null;
              if (info !== undefined) {
                primaryLabel = info.players;
                smallNick = info.nickname;
              }

              return (
                <tr
                  key={team.teamId}
                  className="live-fourths-row"
                  data-variant={rowVariant}
                >
                  <td className="tabular-nums">
                    <span className="live-fourths-rank">{rank}</span>
                  </td>
                  <td>
                    <div className="live-fourths-team-name">{primaryLabel}</div>
                    {smallNick !== null && (
                      <div className="live-team-nick">{smallNick}</div>
                    )}
                  </td>
                  <td>
                    <span className="live-pool-chip">{team.poolLabel}</span>
                  </td>
                  <td className="num tabular-nums">{team.matchesWon}</td>
                  <td className="num live-fourths-ga tabular-nums">
                    <span>{team.pointsScored} pts</span>
                    {hasTieOnScore && (
                      <span className="live-tie-tag">Égalité GA</span>
                    )}
                  </td>
                  <td className="num live-fourths-strength tabular-nums">
                    <strong>{team.poolTotalPoints} pts</strong>
                  </td>
                  <td className="num tabular-nums">
                    {formatSignedDiff(team.pointsDiff)}
                  </td>
                  <td>
                    {team.qualified && (
                      <span className="live-verdict-pill verdict-pass">
                        <CheckIcon size={14} />
                        <span>{verdictText}</span>
                      </span>
                    )}
                    {!team.qualified && (
                      <span className="live-verdict-pill verdict-out">
                        <span>{verdictText}</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
