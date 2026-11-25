"use client";

import { useState } from "react";
import type { TableTeamInfo, TeamSide } from "@/components/table/types";
import {
  AlertTriangleIcon,
  BellAlertIcon,
  FlagIcon,
  XIcon,
} from "@/components/icons/Icons";

interface RefereeModalProps {
  open: boolean;
  tableNumber: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const DEFAULT_REFEREE_REASON = "Question sur une règle";

const REFEREE_REASONS: readonly string[] = [
  DEFAULT_REFEREE_REASON,
  "Erreur de score à corriger",
  "Parlante / litige à table",
  "Autre demande",
];

/**
 * Modale d'appel d'un arbitre reliee au dashboard admin.
 */
export function RefereeModal(props: RefereeModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>(
    DEFAULT_REFEREE_REASON,
  );

  if (!props.open) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="referee-modal-title"
    >
      <div className="modal-sheet">
        <div className="modal-header">
          <h2 id="referee-modal-title" className="section-title">
            Appeler un arbitre · Table {props.tableNumber}
          </h2>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={props.onClose}
            aria-label="Fermer"
          >
            <XIcon size={16} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-secondary)" }}>
          Une alerte temps réel est envoyée au poste de pilotage de
          l&apos;organisation. Précisez le motif :
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {REFEREE_REASONS.map((reason) => {
            let btnClass = "btn btn-secondary btn-full";
            if (selectedReason === reason) {
              btnClass = "btn btn-primary btn-full";
            }
            return (
              <button
                key={reason}
                type="button"
                className={btnClass}
                style={{ justifyContent: "flex-start" }}
                onClick={() => setSelectedReason(reason)}
              >
                {reason}
              </button>
            );
          })}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={props.onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-terracotta"
            onClick={() => props.onConfirm(selectedReason)}
          >
            <BellAlertIcon size={16} />
            <span>Envoyer l&apos;alerte</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface AbandonModalProps {
  open: boolean;
  tableNumber: number;
  teamA: TableTeamInfo;
  teamB: TableTeamInfo;
  onClose: () => void;
  onConfirmForfeit: (forfeitSide: TeamSide) => void;
}

/**
 * Modale d'abandon avec double confirmation obligatoire (regle GEMINI.md).
 */
export function AbandonModal(props: AbandonModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [forfeitSide, setForfeitSide] = useState<TeamSide>("team_a");

  if (!props.open) {
    return null;
  }

  let forfeitingTeamName = props.teamA.name;
  if (forfeitSide === "team_b") {
    forfeitingTeamName = props.teamB.name;
  }

  let sideAActive = "false";
  let sideBActive = "false";
  if (forfeitSide === "team_a") {
    sideAActive = "true";
  } else {
    sideBActive = "true";
  }

  function handleClose() {
    setStep(1);
    props.onClose();
  }

  function handleFinalConfirm() {
    setStep(1);
    props.onConfirmForfeit(forfeitSide);
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="abandon-modal-title"
    >
      <div className="modal-sheet">
        <div className="modal-header">
          <h2
            id="abandon-modal-title"
            className="section-title"
            style={{ color: "var(--status-fail)" }}
          >
            Abandon · Table {props.tableNumber}
          </h2>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleClose}
            aria-label="Fermer"
          >
            <XIcon size={16} />
          </button>
        </div>

        {step === 1 && (
          <>
            <div className="banner banner-fail">
              <AlertTriangleIcon
                size={18}
                style={{ flexShrink: 0, marginTop: "1px" }}
              />
              <span>
                Étape 1/2 : L&apos;abandon déclare un forfait immédiat pour le
                match et prévient l&apos;administration.
              </span>
            </div>

            <div>
              <span className="field-label">Quelle équipe abandonne ?</span>
              <div className="segmented">
                <button
                  type="button"
                  className="segmented-btn"
                  data-active={sideAActive}
                  onClick={() => setForfeitSide("team_a")}
                >
                  {props.teamA.name}
                </button>
                <button
                  type="button"
                  className="segmented-btn"
                  data-active={sideBActive}
                  onClick={() => setForfeitSide("team_b")}
                >
                  {props.teamB.name}
                </button>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-fail"
                onClick={() => setStep(2)}
              >
                Continuer (1/2)
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="banner banner-fail">
              <FlagIcon size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>
                Étape 2/2 (confirmation finale) : confirmez-vous l&apos;abandon
                définitif de <strong>{forfeitingTeamName}</strong> ?
              </span>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(1)}
              >
                Retour
              </button>
              <button
                type="button"
                className="btn btn-fail"
                onClick={handleFinalConfirm}
              >
                Confirmer l&apos;abandon
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
