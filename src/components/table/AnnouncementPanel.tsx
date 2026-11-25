"use client";

import type { AnnouncementType } from "@/types/database";
import type {
  PendingLiveAnnouncement,
  TableTeamInfo,
  TeamSide,
} from "@/components/table/types";
import { CheckIcon, MegaphoneIcon, XIcon } from "@/components/icons/Icons";

interface AnnouncementPanelProps {
  teamA: TableTeamInfo;
  teamB: TableTeamInfo;
  selectedSide: TeamSide;
  onSelectSide: (side: TeamSide) => void;
  pendingAnnouncement: PendingLiveAnnouncement | null;
  lastLiveFeedMessage: string | null;
  disabled: boolean;
  onTriggerAnnouncement: (type: AnnouncementType) => void;
  onResolveAnnouncement: (outcome: "passed" | "failed") => void;
  onCancelPending: () => void;
}

interface AnnouncementButtonMeta {
  type: AnnouncementType;
  label: string;
  sublabel: string;
}

const ANNOUNCEMENT_BUTTONS: readonly AnnouncementButtonMeta[] = [
  {
    type: "capot",
    label: "Annoncer Capot",
    sublabel: "250 pts si fait",
  },
  {
    type: "generale",
    label: "Annoncer Générale",
    sublabel: "500 pts si faite",
  },
  {
    type: "coinche",
    label: "Annoncer Coinche",
    sublabel: "Contrat x2",
  },
  {
    type: "surcoinche",
    label: "Annoncer Surcoinche",
    sublabel: "Contrat x4",
  },
];

function formatAnnouncementTitle(type: AnnouncementType): string {
  if (type === "capot") {
    return "Capot";
  }
  if (type === "generale") {
    return "Générale";
  }
  if (type === "coinche") {
    return "Coinche";
  }
  return "Surcoinche";
}

/**
 * Panneau d'annonces manuelles (jamais automatiques).
 * Chaque clic envoie un pop-up temps reel sur /live, puis Passé / Chuté envoie le resultat.
 */
export function AnnouncementPanel(props: AnnouncementPanelProps) {
  let teamAActive = "false";
  let teamBActive = "false";
  if (props.selectedSide === "team_a") {
    teamAActive = "true";
  } else {
    teamBActive = "true";
  }

  return (
    <section className="card" aria-labelledby="announcements-heading">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "10px",
        }}
      >
        <h2 id="announcements-heading" className="section-title">
          Annonces en direct
        </h2>
        <span className="badge badge-amber">
          <MegaphoneIcon size={12} />
          <span>Écran /live</span>
        </span>
      </div>

      <p
        style={{
          margin: "0 0 10px",
          fontSize: "12.5px",
          color: "var(--ink-secondary)",
        }}
      >
        Déclenchement manuel sur le vidéoprojecteur. Sélectionnez l&apos;équipe
        puis cliquez sur l&apos;annonce.
      </p>

      <div
        className="segmented"
        role="group"
        aria-label="Équipe à l'origine de l'annonce"
        style={{ marginBottom: "10px" }}
      >
        <button
          type="button"
          className="segmented-btn"
          data-active={teamAActive}
          disabled={props.disabled || props.pendingAnnouncement !== null}
          onClick={() => props.onSelectSide("team_a")}
        >
          {props.teamA.name}
        </button>
        <button
          type="button"
          className="segmented-btn"
          data-active={teamBActive}
          disabled={props.disabled || props.pendingAnnouncement !== null}
          onClick={() => props.onSelectSide("team_b")}
        >
          {props.teamB.name}
        </button>
      </div>

      <div className="announcement-grid">
        {ANNOUNCEMENT_BUTTONS.map((item) => {
          let isCurrent = "false";
          if (
            props.pendingAnnouncement !== null &&
            props.pendingAnnouncement.type === item.type
          ) {
            isCurrent = "true";
          }

          return (
            <button
              key={item.type}
              type="button"
              className="announce-btn"
              data-active={isCurrent}
              disabled={props.disabled || props.pendingAnnouncement !== null}
              onClick={() => props.onTriggerAnnouncement(item.type)}
            >
              <span className="announce-btn-title">{item.label}</span>
              <span className="announce-btn-sub">{item.sublabel}</span>
            </button>
          );
        })}
      </div>

      {props.pendingAnnouncement !== null && (
        <div className="pending-outcome-box" role="status" aria-live="polite">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div>
              <div
                className="font-display"
                style={{
                  fontSize: "18px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  color: "var(--accent-amber)",
                }}
              >
                {formatAnnouncementTitle(props.pendingAnnouncement.type)} annoncé
                · {props.pendingAnnouncement.teamName}
              </div>
              <div style={{ fontSize: "12px", color: "#DFD4C0" }}>
                Pop-up diffusé sur /live à {props.pendingAnnouncement.sentAtLabel}.
                Validez l&apos;issue à la fin de la donne :
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={props.onCancelPending}
              aria-label="Annuler l'annonce en cours"
              style={{ minHeight: "32px", padding: "0 8px" }}
            >
              <XIcon size={15} />
            </button>
          </div>

          <div className="pending-outcome-actions">
            <button
              type="button"
              className="btn btn-pass"
              onClick={() => props.onResolveAnnouncement("passed")}
            >
              <CheckIcon size={17} />
              <span>Passé</span>
            </button>
            <button
              type="button"
              className="btn btn-fail"
              onClick={() => props.onResolveAnnouncement("failed")}
            >
              <XIcon size={17} />
              <span>Chuté</span>
            </button>
          </div>
        </div>
      )}

      {props.lastLiveFeedMessage !== null &&
        props.pendingAnnouncement === null && (
          <div
            className="banner banner-info"
            role="status"
            style={{ marginTop: "10px" }}
          >
            <MegaphoneIcon size={16} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>{props.lastLiveFeedMessage}</span>
          </div>
        )}
    </section>
  );
}
