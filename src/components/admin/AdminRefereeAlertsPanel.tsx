"use client";

import {
  AlertTriangleIcon,
  BellAlertIcon,
  CheckIcon,
  FlagIcon,
} from "@/components/icons/Icons";
import type { AdminRefereeAlertItem } from "@/components/admin/admin-types";

interface AdminRefereeAlertsPanelProps {
  alerts: AdminRefereeAlertItem[];
  onHandleAlert: (
    alertId: string,
    resolution: "acknowledge" | "resolve" | "confirm_forfeit",
  ) => void;
}

export function AdminRefereeAlertsPanel(props: AdminRefereeAlertsPanelProps) {
  const openCount = props.alerts.filter((a) => a.status !== "resolved").length;

  let counterBadgeClass = "badge badge-pass";
  let counterBadgeLabel = "Aucune urgence";
  if (openCount > 0) {
    counterBadgeClass = "badge badge-fail";
    counterBadgeLabel = `${openCount} alerte(s) active(s)`;
  }

  return (
    <section
      className="admin-panel admin-panel-alert"
      aria-labelledby="admin-alerts-heading"
    >
      <div className="admin-panel-header">
        <div className="admin-panel-title-wrap">
          <BellAlertIcon size={20} />
          <h2 id="admin-alerts-heading" className="admin-panel-title">
            Alertes Arbitre &amp; Abandons
          </h2>
        </div>
        <span className={counterBadgeClass}>{counterBadgeLabel}</span>
      </div>

      <p className="admin-panel-subtitle">
        Signaux prioritaires envoyés en temps réel depuis l&apos;écran mobile{" "}
        <strong>Ma table</strong> (<code>Appeler un arbitre</code> ou{" "}
        <code>Abandon</code> double-confirmé).
      </p>

      <div className="admin-alerts-list">
        {props.alerts.length === 0 && (
          <div className="card-alt">
            <p className="admin-subtitle">
              Aucun appel d&apos;arbitre ni demande d&apos;abandon en attente.
            </p>
          </div>
        )}

        {props.alerts.map((alert) => {
          let typeBadgeClass = "badge badge-terracotta";
          let typeLabel = "Appel Arbitre";
          if (alert.alertType === "abandon_request") {
            typeBadgeClass = "badge badge-fail";
            typeLabel = "Demande d'Abandon";
          }

          let statusBadgeClass = "badge badge-fail";
          let statusLabel = "Ouverte";
          if (alert.status === "acknowledged") {
            statusBadgeClass = "badge badge-amber";
            statusLabel = "En prise en charge";
          } else if (alert.status === "resolved") {
            statusBadgeClass = "badge badge-pass";
            statusLabel = `Résolue (${alert.resolvedAtLabel ?? "OK"})`;
          }

          return (
            <article
              key={alert.id}
              className="admin-alert-card"
              data-type={alert.alertType}
              data-status={alert.status}
            >
              <div className="admin-alert-top">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="admin-alert-table">
                    Table {alert.tableNumber}
                  </span>
                  <span className={typeBadgeClass}>{typeLabel}</span>
                </div>
                <span className={statusBadgeClass}>
                  {statusLabel} · {alert.createdAtLabel}
                </span>
              </div>

              <p className="admin-alert-msg">
                <strong>{alert.requestingTeamName}</strong> : {alert.message}
              </p>

              {alert.status !== "resolved" && (
                <div className="admin-alert-actions">
                  {alert.status === "open" && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() =>
                        props.onHandleAlert(alert.id, "acknowledge")
                      }
                    >
                      <AlertTriangleIcon size={14} />
                      <span>Prendre en charge</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-sm btn-pass"
                    onClick={() => props.onHandleAlert(alert.id, "resolve")}
                  >
                    <CheckIcon size={14} />
                    <span>Résoudre</span>
                  </button>

                  {alert.alertType === "abandon_request" && (
                    <button
                      type="button"
                      className="btn btn-sm btn-fail"
                      onClick={() =>
                        props.onHandleAlert(alert.id, "confirm_forfeit")
                      }
                    >
                      <FlagIcon size={14} />
                      <span>Valider forfait</span>
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
