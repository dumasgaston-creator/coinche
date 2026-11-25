"use client";

import type { PoolStandingSummary, QualifiedTeamSeed } from "@/lib/tournament/types";
import type { LiveTeamDisplayInfo } from "@/components/live/types";

interface PoolsViewProps {
  pools: PoolStandingSummary[];
  wildcardCandidates: QualifiedTeamSeed[];
  qualifiedLookup?: Record<string, QualifiedTeamSeed>;
  directTopRank?: number;
  wildcardRank?: number | null;
  teamDisplayById?: Record<string, LiveTeamDisplayInfo>;
}

function getQualifiedWildcardIds(
  wildcardCandidates: QualifiedTeamSeed[],
): Set<string> {
  const ids = new Set<string>();
  for (const candidate of wildcardCandidates) {
    if (candidate.qualified) {
      ids.add(candidate.teamId);
    }
  }
  return ids;
}

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

/**
 * Vue 1 : Classement des 5 poules A a E en direct.
 * Code couleur : 3 premiers qualifies directs (vert), 4e meilleur en ballotage favorable (ambre).
 */
export function PoolsView(props: PoolsViewProps) {
  const qualifiedWildcardIds = getQualifiedWildcardIds(props.wildcardCandidates);
  const directTop = props.directTopRank ?? 3;
  const wildcardRankNum = props.wildcardRank ?? 4;

  if (props.pools.length === 0) {
    return (
      <section className="live-empty-panel">
        <p>Aucune poule n&apos;est encore générée pour ce tournoi.</p>
      </section>
    );
  }

  return (
    <section className="live-view-section" aria-label="Classement des poules">
      <div className="live-legend-bar">
        <span className="live-legend-item">
          <span className="live-legend-swatch swatch-pass" />
          <span>Top {directTop} · Qualifié direct</span>
        </span>
        {props.wildcardRank !== null && (
          <span className="live-legend-item">
            <span className="live-legend-swatch swatch-amber" />
            <span>Meilleur(s) {wildcardRankNum}e(s) · Qualifié (8es)</span>
          </span>
        )}
        <span className="live-legend-item">
          <span className="live-legend-swatch swatch-muted" />
          <span>Autres rangs · Élimination directe</span>
        </span>
      </div>

      <div className="live-pools-grid">
        {props.pools.map((pool) => (
          <article key={pool.poolNumber} className="live-pool-card">
            <header className="live-pool-header">
              <h2 className="live-pool-title">{pool.poolLabel}</h2>
              <span
                className="live-pool-strength tabular-nums"
                title="Force de la poule (cumul total des points marqués)"
              >
                Force poule · {pool.poolTotalPoints} pts
              </span>
            </header>

            <div className="live-pool-table-wrap">
              <table className="live-pool-table">
                <thead>
                  <tr>
                    <th scope="col" className="col-rank">
                      #
                    </th>
                    <th scope="col" className="col-team">
                      Joueurs
                    </th>
                    <th scope="col" className="col-num" title="Matchs joués">
                      J
                    </th>
                    <th scope="col" className="col-num" title="Victoires">
                      V
                    </th>
                    <th
                      scope="col"
                      className="col-num"
                      title="Goal-average (total des points marqués)"
                    >
                      Pts
                    </th>
                    <th scope="col" className="col-num" title="Différence">
                      Diff
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pool.standings.map((team) => {
                    const qualEntry = props.qualifiedLookup?.[team.teamId];
                    let rowState = "eliminated";
                    let statusTag = `${team.poolRank}e`;
                    if (team.isForfeit) {
                      rowState = "forfeit";
                      statusTag = "Forfait";
                    } else if (qualEntry !== undefined) {
                      if (qualEntry.qualified) {
                        if (qualEntry.qualificationReason === "best_wildcards") {
                          rowState = "wildcard-lead";
                          statusTag = `M${team.poolRank}`;
                        } else {
                          rowState = "direct";
                          statusTag = "Q";
                        }
                      }
                    } else if (team.poolRank <= directTop) {
                      rowState = "direct";
                      statusTag = "Q";
                    } else if (qualifiedWildcardIds.has(team.teamId)) {
                      rowState = "wildcard-lead";
                      statusTag = `M${team.poolRank}`;
                    }

                    const displayInfo = props.teamDisplayById?.[team.teamId];
                    let primaryLabel = team.teamName;
                    let smallNick: string | null = null;
                    if (displayInfo !== undefined) {
                      primaryLabel = displayInfo.players;
                      smallNick = displayInfo.nickname;
                    }

                    return (
                      <tr
                        key={team.teamId}
                        className="live-pool-row"
                        data-state={rowState}
                      >
                        <td className="col-rank tabular-nums">
                          <span className="live-rank-pill">{team.poolRank}</span>
                        </td>
                        <td className="col-team">
                          <div className="live-team-cell">
                            <div className="live-team-stack">
                              <span className="live-team-name">
                                {primaryLabel}
                              </span>
                              {smallNick !== null && (
                                <span className="live-team-nick">
                                  {smallNick}
                                </span>
                              )}
                            </div>
                            <span className="live-status-mini">{statusTag}</span>
                          </div>
                        </td>
                        <td className="col-num tabular-nums">
                          {team.matchesPlayed}
                        </td>
                        <td className="col-num live-win-cell tabular-nums">
                          {team.matchesWon}
                        </td>
                        <td className="col-num live-pts-cell tabular-nums">
                          {team.pointsScored}
                        </td>
                        <td className="col-num live-diff-cell tabular-nums">
                          {formatDiff(team.pointsDiff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
