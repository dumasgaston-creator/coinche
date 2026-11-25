"use client";

import type { TableDealItem, TableTeamInfo } from "@/components/table/types";
import { EditIcon, LockIcon } from "@/components/icons/Icons";

interface ScoreHistoryListProps {
  deals: TableDealItem[];
  teamA: TableTeamInfo;
  teamB: TableTeamInfo;
  editingEnabled: boolean;
  editingDealId: string | null;
  onStartEditDeal: (deal: TableDealItem) => void;
}

function formatSpecialBadge(deal: TableDealItem): string | null {
  if (deal.specialAnnouncement === null) {
    return null;
  }

  let label = "Annonce";
  if (deal.specialAnnouncement === "capot") {
    label = "Capot";
  } else if (deal.specialAnnouncement === "generale") {
    label = "Générale";
  } else if (deal.specialAnnouncement === "coinche") {
    label = "Coinche";
  } else if (deal.specialAnnouncement === "surcoinche") {
    label = "Surcoinche";
  }

  if (deal.announcementOutcome === "passed") {
    return `${label} · Passé`;
  }
  if (deal.announcementOutcome === "failed") {
    return `${label} · Chuté`;
  }
  return label;
}

/**
 * Liste des donnes enregistrees pour la table avec possibilite de modification
 * (desactivable a tout moment par l'administrateur).
 */
export function ScoreHistoryList(props: ScoreHistoryListProps) {
  return (
    <section className="card" aria-labelledby="history-heading">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <h2 id="history-heading" className="section-title">
          Feuille de marque
        </h2>
        {!props.editingEnabled && (
          <span className="badge badge-neutral">
            <LockIcon size={11} />
            <span>Verrouillé admin</span>
          </span>
        )}
      </div>

      {props.deals.length === 0 && (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: "13px",
            color: "var(--ink-muted)",
          }}
        >
          Aucune donne enregistrée pour le moment. Saisissez le résultat de la
          donne 1 ci-dessus.
        </p>
      )}

      {props.deals.length > 0 && (
        <ul className="deal-list">
          {props.deals.map((deal) => {
            const specialLabel = formatSpecialBadge(deal);
            let badgeClass = "badge badge-amber";
            if (deal.announcementOutcome === "passed") {
              badgeClass = "badge badge-pass";
            } else if (deal.announcementOutcome === "failed") {
              badgeClass = "badge badge-fail";
            }

            let isBeingEdited = false;
            if (props.editingDealId === deal.id) {
              isBeingEdited = true;
            }

            let editButtonLabel = "Modifier";
            if (isBeingEdited) {
              editButtonLabel = "En cours";
            }

            return (
              <li key={deal.id} className="deal-row">
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--ink-secondary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Donne {deal.dealNumber}
                    </span>

                    {deal.isTiebreaker && (
                      <span className="badge badge-terracotta">Départage</span>
                    )}

                    {specialLabel !== null && (
                      <span className={badgeClass}>{specialLabel}</span>
                    )}

                    {deal.parlantePenalty && (
                      <span className="badge badge-fail">Parlante +160</span>
                    )}
                  </div>

                  <div
                    className="deal-row-scores"
                    style={{ marginTop: "4px", color: "var(--ink-primary)" }}
                  >
                    <span>{deal.pointsTeamA}</span>
                    <span
                      style={{
                        margin: "0 8px",
                        color: "var(--ink-muted)",
                        fontWeight: 600,
                      }}
                    >
                      –
                    </span>
                    <span>{deal.pointsTeamB}</span>
                  </div>
                </div>

                {props.editingEnabled && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => props.onStartEditDeal(deal)}
                    aria-label={`Modifier la donne ${deal.dealNumber}`}
                    disabled={isBeingEdited}
                  >
                    <EditIcon size={14} />
                    <span>{editButtonLabel}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
