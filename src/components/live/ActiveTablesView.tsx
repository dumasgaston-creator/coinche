"use client";

import type { LiveTableMatchItem } from "@/components/live/types";

interface ActiveTablesViewProps {
  matches: LiveTableMatchItem[];
}

function buildDealSlotArray(maxDeals: number): number[] {
  const slots: number[] = [];
  for (let i = 1; i <= maxDeals; i += 1) {
    slots.push(i);
  }
  return slots;
}

/**
 * Vue 3 : Grille temps reel des tables actives.
 * Scores en direct, avancement des 5 donnes (+ 6e donne decisive), annonces recentes.
 */
export function ActiveTablesView(props: ActiveTablesViewProps) {
  if (props.matches.length === 0) {
    return (
      <section className="live-empty-panel">
        <p>Aucun match en cours pour le moment.</p>
      </section>
    );
  }

  return (
    <section
      className="live-view-section"
      aria-label="Matchs en cours aux tables"
    >
      <div className="live-tables-grid">
        {props.matches.map((match) => {
          const isTiebreaker =
            match.phase === "pool" &&
            match.dealsPlayed >= (match.maxDeals ?? 5) &&
            match.scoreTeamA === match.scoreTeamB &&
            match.status !== "completed";

          let teamALeading = "false";
          let teamBLeading = "false";
          if (match.scoreTeamA > match.scoreTeamB) {
            teamALeading = "true";
          } else if (match.scoreTeamB > match.scoreTeamA) {
            teamBLeading = "true";
          }

          let progressBadge = `Donne ${match.dealsPlayed} / ${match.maxDeals ?? 5}`;
          let progressTone = "live";
          if (match.targetScore !== null) {
            progressBadge = `Objectif ${match.targetScore} pts`;
          }
          if (match.status === "completed") {
            progressBadge = "Terminé";
            progressTone = "done";
          } else if (isTiebreaker) {
            progressBadge = "6e donne décisive";
            progressTone = "tiebreak";
          } else if (match.status === "pending") {
            progressBadge = "En attente";
            progressTone = "pending";
          }

          const dealSlots = buildDealSlotArray(match.maxDeals ?? 5);

          return (
            <article
              key={match.id}
              className="live-table-card"
              data-status={progressTone}
            >
              <header className="live-table-card-head">
                <div className="live-table-id">
                  <span className="live-table-num tabular-nums">
                    Table {match.tableNumber}
                  </span>
                  <span className="live-table-phase">{match.phaseLabel}</span>
                </div>
                <span
                  className="live-table-progress-pill tabular-nums"
                  data-tone={progressTone}
                >
                  {progressBadge}
                </span>
              </header>

              <div className="live-table-score-rows">
                <div className="live-table-team-row" data-leading={teamALeading}>
                  <div className="live-table-team-meta">
                    <span className="live-table-team-name">
                      {match.teamAPlayers}
                    </span>
                    {match.teamANickname !== undefined &&
                      match.teamANickname !== null && (
                        <span className="live-table-team-players">
                          {match.teamANickname}
                        </span>
                      )}
                  </div>
                  <span className="live-table-score tabular-nums">
                    {match.scoreTeamA}
                  </span>
                </div>

                <div className="live-table-team-row" data-leading={teamBLeading}>
                  <div className="live-table-team-meta">
                    <span className="live-table-team-name">
                      {match.teamBPlayers}
                    </span>
                    {match.teamBNickname !== undefined &&
                      match.teamBNickname !== null && (
                        <span className="live-table-team-players">
                          {match.teamBNickname}
                        </span>
                      )}
                  </div>
                  <span className="live-table-score tabular-nums">
                    {match.scoreTeamB}
                  </span>
                </div>
              </div>

              <footer className="live-table-card-foot">
                {match.phase === "pool" && (
                  <div
                    className="live-deal-pips"
                    aria-label={`${match.dealsPlayed} donnes jouées`}
                  >
                    {dealSlots.map((slot) => {
                      let filled = "false";
                      if (match.dealsPlayed >= slot) {
                        filled = "true";
                      }
                      return (
                        <span
                          key={slot}
                          className="live-deal-pip"
                          data-filled={filled}
                        />
                      );
                    })}
                    {(isTiebreaker || match.dealsPlayed > (match.maxDeals ?? 5)) && (
                      <span
                        className="live-deal-pip"
                        data-tiebreaker="true"
                        title="6e donne de départage"
                      />
                    )}
                  </div>
                )}

                {match.recentAnnouncement !== null && (
                  <span
                    className="live-table-note"
                    data-tone={match.recentAnnouncementTone}
                  >
                    {match.recentAnnouncement}
                  </span>
                )}
                {match.recentAnnouncement === null && (
                  <span className="live-table-note" data-tone="neutral">
                    Rythme libre · Saisie directe
                  </span>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
