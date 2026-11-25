"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  EditIcon,
  LockIcon,
  ProjectorScreenIcon,
  TrophyIcon,
} from "@/components/icons/Icons";
import { formatTournamentStatusLabel } from "@/components/admin/admin-demo-data";
import type { AdminTournamentMeta } from "@/components/admin/admin-types";
import type { TournamentStatus } from "@/types/database";

interface AdminControlHeaderProps {
  tournament: AdminTournamentMeta;
  checkedInCount: number;
  totalTeamCount: number;
  openAlertsCount: number;
  adminDisplayName: string;
  isSubmitting: boolean;
  onAdminLogout: () => void;
  onUpdateTournamentTitle: (nextTitle: string) => void;
  onTogglePlayerScoreEditing: () => void;
  onGeneratePools: () => void;
  onAdvanceToKnockout: () => void;
  onSetTournamentPhase: (status: TournamentStatus) => void;
  onThresholdChange: (nextThreshold: number) => void;
  onResetTournament: (mode: "demo" | "clean_checkin") => void;
}

const TOURNAMENT_PHASE_STEPS: Array<{
  status: TournamentStatus;
  label: string;
}> = [
  { status: "checkin", label: "Check-in 18h30" },
  { status: "pools", label: "Poules (5 donnes)" },
  { status: "round_of_16", label: "8es · 500 pts" },
  { status: "quarterfinals", label: "Quarts · 600 pts" },
  { status: "semifinals", label: "Demies · 700 pts" },
  { status: "final", label: "Finale · 1000 pts" },
];

export function AdminControlHeader(props: AdminControlHeaderProps) {
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const [titleDraft, setTitleDraft] = useState<string>(props.tournament.title);
  const [confirmResetMode, setConfirmResetMode] = useState<
    "demo" | "clean_checkin" | null
  >(null);

  function handleSaveTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = titleDraft.trim();
    if (cleaned.length >= 3) {
      props.onUpdateTournamentTitle(cleaned);
    }
    setEditingTitle(false);
  }

  let lockSwitchButtonText = "Verrouiller la saisie joueurs";
  let lockSwitchButtonClass = "btn btn-sm btn-ghost-danger";
  let lockStatusTitle = "Saisie joueurs autorisée";
  let lockStatusDesc =
    "Les tables peuvent saisir leurs donnes et annonces sur mobile.";

  if (!props.tournament.playerScoreEditingEnabled) {
    lockSwitchButtonText = "Réautoriser la saisie joueurs";
    lockSwitchButtonClass = "btn btn-sm btn-pass";
    lockStatusTitle = "Saisie joueurs verrouillée";
    lockStatusDesc =
      "Seul ce poste administrateur peut modifier les scores des tables.";
  }

  return (
    <>
      <section
        className="admin-auth-bar"
        aria-label="Session Administrateur active"
      >
        <div className="admin-auth-status">
          <span className="admin-status-dot" data-authenticated="true" />
          <span className="badge badge-pass">
            Admin déverrouillé · {props.adminDisplayName}
          </span>
          <span className="admin-subtitle">
            Cookie `httpOnly` signé · Modifications propagées en direct vers
            `/ma-table`, `/classement` et `/live`
          </span>
        </div>

        <div className="admin-auth-form">
          <Link href="/live" className="btn btn-sm btn-secondary">
            <ProjectorScreenIcon size={14} />
            <span>Ouvrir /live</span>
          </Link>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setConfirmResetMode("clean_checkin")}
          >
            <span>Soirée vierge (0 pt)</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setConfirmResetMode("demo")}
          >
            <span>Restaurer démo (20 éq.)</span>
          </button>

          <button
            type="button"
            className="btn btn-sm btn-ghost-danger"
            onClick={props.onAdminLogout}
          >
            <LockIcon size={14} />
            <span>Verrouiller Admin</span>
          </button>
        </div>
      </section>

      {confirmResetMode !== null && (
        <div className="banner banner-fail" role="alert">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              width: "100%",
              flexWrap: "wrap",
            }}
          >
            <span>
              {confirmResetMode === "clean_checkin" &&
                "Confirmer la réinitialisation complète à 0 point (phase Check-in avant 18h30) ?"}
              {confirmResetMode === "demo" &&
                "Confirmer le rechargement du tournoi de démonstration complet (20 équipes, 5 poules) ?"}
            </span>
            <div style={{ display: "inline-flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setConfirmResetMode(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-sm btn-fail"
                onClick={() => {
                  const chosen = confirmResetMode;
                  setConfirmResetMode(null);
                  props.onResetTournament(chosen);
                }}
              >
                Confirmer la réinitialisation
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="admin-command-bar">
        <div className="admin-command-top">
          <div className="admin-title-block">
            <span className="eyebrow">
              <TrophyIcon size={14} />
              <span>Poste de pilotage Coinch&apos;Eirb · Contrôle total</span>
            </span>

            {!editingTitle && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <h1 className="admin-main-title">{props.tournament.title}</h1>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setTitleDraft(props.tournament.title);
                    setEditingTitle(true);
                  }}
                >
                  <EditIcon size={13} />
                  <span>Renommer soirée</span>
                </button>
              </div>
            )}

            {editingTitle && (
              <form
                onSubmit={handleSaveTitle}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "4px",
                }}
              >
                <input
                  type="text"
                  className="admin-auth-input"
                  style={{ minWidth: "260px" }}
                  value={titleDraft}
                  maxLength={80}
                  onChange={(e) => setTitleDraft(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  Enregistrer
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setEditingTitle(false)}
                >
                  Annuler
                </button>
              </form>
            )}

            <p className="admin-subtitle">
              État actif :{" "}
              <strong>
                {formatTournamentStatusLabel(props.tournament.status)}
              </strong>{" "}
              ·{" "}
              <span className="tabular-nums">
                {props.checkedInCount}/{props.totalTeamCount}
              </span>{" "}
              équipes pointées au check-in · Départ{" "}
              <span className="tabular-nums">
                {props.tournament.startsAtLabel}
              </span>{" "}
              · Seuil Huitièmes :{" "}
              <span className="tabular-nums">
                {props.tournament.roundOf16Threshold}
              </span>{" "}
              équipes
            </p>
          </div>

          <div
            className="admin-phase-rail"
            role="group"
            aria-label="Phases du tournoi"
          >
            {TOURNAMENT_PHASE_STEPS.map((step) => {
              const isCurrent = props.tournament.status === step.status;
              return (
                <button
                  key={step.status}
                  type="button"
                  className="admin-phase-step"
                  data-current={String(isCurrent)}
                  onClick={() => props.onSetTournamentPhase(step.status)}
                >
                  {isCurrent && <CheckIcon size={13} />}
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-command-actions">
          <div
            className="admin-lock-toggle-card"
            data-locked={String(!props.tournament.playerScoreEditingEnabled)}
          >
            <div className="admin-lock-info">
              <span className="admin-lock-title">{lockStatusTitle}</span>
              <span className="admin-lock-desc">{lockStatusDesc}</span>
            </div>
            <button
              type="button"
              className={lockSwitchButtonClass}
              onClick={props.onTogglePlayerScoreEditing}
              disabled={props.isSubmitting}
            >
              <LockIcon size={15} />
              <span>{lockSwitchButtonText}</span>
            </button>
          </div>

          <div className="admin-primary-triggers">
            <button
              type="button"
              className="btn btn-primary"
              onClick={props.onGeneratePools}
              disabled={props.isSubmitting || props.checkedInCount < 4}
            >
              <ClockIcon size={17} />
              <span>
                Valider check-in &amp; Générer les poules ({props.checkedInCount}{" "}
                éq.)
              </span>
            </button>

            <button
              type="button"
              className="btn btn-terracotta"
              onClick={props.onAdvanceToKnockout}
              disabled={props.isSubmitting}
            >
              <ArrowRightIcon size={17} />
              <span>Clôturer poules &amp; Générer l&apos;Arbre (8es)</span>
            </button>

            <label
              className="badge badge-neutral"
              style={{ minHeight: "38px", padding: "0 10px", gap: "8px" }}
            >
              <span>Seuil 8es :</span>
              <input
                type="number"
                min={4}
                max={32}
                value={props.tournament.roundOf16Threshold}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(val) && val >= 4 && val <= 32) {
                    props.onThresholdChange(val);
                  }
                }}
                style={{
                  width: "50px",
                  backgroundColor: "var(--bg-surface)",
                  color: "var(--ink-primary)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "4px",
                  padding: "2px 4px",
                  textAlign: "center",
                  fontWeight: 700,
                }}
              />
            </label>
          </div>
        </div>
      </header>
    </>
  );
}
