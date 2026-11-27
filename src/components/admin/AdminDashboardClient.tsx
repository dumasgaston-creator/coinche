"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { AdminCheckinImportPanel } from "@/components/admin/AdminCheckinImportPanel";
import { AdminControlHeader } from "@/components/admin/AdminControlHeader";
import { AdminPoolBuilderPanel } from "@/components/admin/AdminPoolBuilderPanel";
import { AdminPosterAndKnockoutPanel } from "@/components/admin/AdminPosterAndKnockoutPanel";
import { AdminRefereeAlertsPanel } from "@/components/admin/AdminRefereeAlertsPanel";
import { AdminTablesLiveGrid } from "@/components/admin/AdminTablesLiveGrid";
import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import type { RawImportedTeamRow } from "@/lib/tournament";
import {
  adminAdvanceToKnockoutInStore,
  adminApplyManualPoolsInStore,
  adminForceUpdateMatchInStore,
  adminGeneratePoolsInStore,
  adminImportTeamsIntoStore,
  adminResetTournamentInStore,
  adminUndoLastDealInStore,
  adminUpdateTeamDetailsInStore,
  broadcastLiveAnnouncementFromStore,
  formatPlayersPrimaryName,
  formatStoreTimeLabel,
  propagateKnockoutWinners,
  updateUnifiedTournamentState,
} from "@/lib/tournament/live-store";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import type {
  AnnouncementType,
  LivePopupPhase,
  MatchStatus,
  RefereeAlertStatus,
  TournamentStatus,
} from "@/types/database";
import {
  AlertTriangleIcon,
  LockIcon,
} from "@/components/icons/Icons";

interface MeAuthPayload {
  profile: {
    id: string;
    displayName: string;
    role: "player" | "admin";
    schoolYear: string;
  } | null;
}

interface AdminDashboardClientProps {
  initialIsAdmin?: boolean;
  initialAdminName?: string;
}

/**
 * Poste de pilotage Administrateur (`/admin`) :
 * - Protege par triple verification cote serveur (`/api/auth/admin/login` : Identifiant Bureau + Mot de passe scrypt + Code PIN + cookie `httpOnly` signe)
 * - Protection anti-bruteforce (4 essais max / blocage 30 min) et piege Honeypot anti-bot
 * - Zero indice de mot de passe expose, zero bouton de test ou de simulation.
 */
export function AdminDashboardClient(props: AdminDashboardClientProps) {
  const { state, summary, syncMode, syncRevision } = useTournamentStore();

  const [isServerAuthenticated, setIsServerAuthenticated] = useState<boolean>(
    props.initialIsAdmin === true,
  );
  const [adminDisplayName, setAdminDisplayName] = useState<string>(
    props.initialAdminName ?? "Bureau Coinch'Eirb",
  );

  const [loginIdentifier, setLoginIdentifier] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginPinCode, setLoginPinCode] = useState<string>("");
  const [loginHoneypot, setLoginHoneypot] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "ok" | "error";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncAdminSession() {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" });
        if (res.ok) {
          const data = (await res.json()) as MeAuthPayload;
          if (!cancelled) {
            if (data.profile !== null && data.profile.role === "admin") {
              setIsServerAuthenticated(true);
              setAdminDisplayName(data.profile.displayName);
            }
          }
        }
      } catch {
        // Garde l'etat verifie par SSR
      }
    }

    void syncAdminSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnlockAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
          pinCode: loginPinCode.trim(),
          honeypot: loginHoneypot,
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        authenticated?: boolean;
        profile?: { displayName?: string };
        error?: string;
      } | null;

      if (!res.ok) {
        let msg = "Accès administrateur refusé.";
        if (body !== null && typeof body.error === "string") {
          msg = body.error;
        }
        setLoginError(msg);
        setLoginLoading(false);
        return;
      }

      let name = "Bureau Coinch'Eirb";
      if (
        body !== null &&
        body.profile !== undefined &&
        typeof body.profile.displayName === "string"
      ) {
        name = body.profile.displayName;
      }

      setIsServerAuthenticated(true);
      setAdminDisplayName(name);
      setLoginPassword("");
      setLoginPinCode("");
    } catch {
      setLoginError(
        "Impossible de joindre le serveur d'authentification. Réessayez.",
      );
    }

    setLoginLoading(false);
  }

  async function handleAdminLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore
    }
    setIsServerAuthenticated(false);
    setFeedback(null);
  }

  async function dispatchAdminControlApi(body: Record<string, unknown>) {
    try {
      await fetch("/api/admin/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Le store temps reel unifie reste synchronise
    }
  }

  async function handleTogglePlayerScoreEditing() {
    const nextEnabled = !state.tournament.playerScoreEditingEnabled;
    setIsSubmitting(true);

    updateUnifiedTournamentState((prev) => ({
      ...prev,
      tournament: {
        ...prev.tournament,
        playerScoreEditingEnabled: nextEnabled,
      },
    }));

    await dispatchAdminControlApi({
      action: "toggle_player_score_editing",
      tournamentId: state.tournament.id,
      enabled: nextEnabled,
    });

    if (nextEnabled) {
      setFeedback({
        message:
          "Saisie des scores par les joueurs RÉAUTORISÉE sur /ma-table.",
        tone: "ok",
      });
    } else {
      setFeedback({
        message:
          "Saisie des scores par les joueurs VERROUILLÉE en direct sur /ma-table.",
        tone: "ok",
      });
    }
    setIsSubmitting(false);
  }

  async function handleGeneratePools() {
    const activeTeams = state.teams.filter((t) => t.checkedIn && !t.isForfeit);
    if (activeTeams.length < 4) {
      setFeedback({
        message:
          "Au moins 4 équipes pointées au check-in sont requises pour générer les poules.",
        tone: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = adminGeneratePoolsInStore();

      await dispatchAdminControlApi({
        action: "generate_pools",
        tournamentId: updated.tournament.id,
        startsAtTimeLabel: updated.tournament.startsAtLabel,
        dealsPerMatch: updated.tournament.dealsPerPoolMatch,
        teams: updated.teams,
      });

      setFeedback({
        message: `Check-in figé : ${activeTeams.length} équipes réparties en ${updated.pools.length} poules (${updated.matches.length} matchs créés et synchronisés avec /ma-table et /live).`,
        tone: "ok",
      });
    } catch (err) {
      let msg = "Erreur lors de la génération des poules.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setFeedback({ message: msg, tone: "error" });
    }
    setIsSubmitting(false);
  }

  async function handleAdvanceToKnockout() {
    setIsSubmitting(true);
    try {
      const outcome = adminAdvanceToKnockoutInStore();

      await dispatchAdminControlApi({
        action: "advance_to_round_of_16",
        tournamentId: state.tournament.id,
        roundOf16Threshold: state.tournament.roundOf16Threshold,
      });

      let targetPhaseName = "Phase finale";
      if (outcome.startingPhase === "round_of_16") {
        targetPhaseName = "Huitièmes de finale (500 pts)";
      }

      setFeedback({
        message: `Poules clôturées : ${outcome.qualifiedCount} équipes qualifiées en ${targetPhaseName} (${outcome.eliminatedCount} éliminées). L'arbre final est actif sur /ma-table, /classement et /live !`,
        tone: "ok",
      });
    } catch (err) {
      let msg = "Impossible de générer l'arbre final.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setFeedback({ message: msg, tone: "error" });
    }
    setIsSubmitting(false);
  }

  async function handleForceUpdateMatch(params: {
    matchId: string;
    scoreTeamA: number;
    scoreTeamB: number;
    status: MatchStatus;
    lockedByAdmin: boolean;
    forfeitTeamId: string | null;
  }) {
    adminForceUpdateMatchInStore(params);

    await dispatchAdminControlApi({
      action: "force_match_override",
      tournamentId: state.tournament.id,
      ...params,
    });

    setFeedback({
      message: `Score et statut enregistrés par l'administrateur (${params.scoreTeamA} – ${params.scoreTeamB}) · Poules, arbre et /live mis à jour.`,
      tone: "ok",
    });
  }

  async function handleRefereeAlert(
    alertId: string,
    resolution: "acknowledge" | "resolve" | "confirm_forfeit",
  ) {
    const targetAlert = state.alerts.find((a) => a.id === alertId) ?? null;

    let nextAlertStatus: RefereeAlertStatus = "acknowledged";
    if (resolution === "resolve" || resolution === "confirm_forfeit") {
      nextAlertStatus = "resolved";
    }

    updateUnifiedTournamentState((prev) => {
      const updatedAlerts = prev.alerts.map((alert) => {
        if (alert.id !== alertId) {
          return alert;
        }
        let resolvedLabel: string | null = alert.resolvedAtLabel;
        if (nextAlertStatus === "resolved") {
          resolvedLabel = formatStoreTimeLabel();
        }
        return {
          ...alert,
          status: nextAlertStatus,
          resolvedAtLabel: resolvedLabel,
        };
      });

      let updatedTeams = prev.teams;
      let updatedMatches = prev.matches;

      if (resolution === "confirm_forfeit" && targetAlert !== null) {
        const forfeitTeamId = targetAlert.requestingTeamId;
        updatedTeams = prev.teams.map((t) => {
          if (t.id === forfeitTeamId) {
            return { ...t, isForfeit: true };
          }
          return t;
        });

        updatedMatches = prev.matches.map((m) => {
          if (m.id !== targetAlert.matchId) {
            return m;
          }
          let winnerId = m.teamAId;
          let scoreA = 500;
          let scoreB = 0;
          if (m.teamAId === forfeitTeamId) {
            winnerId = m.teamBId;
            scoreA = 0;
            scoreB = 500;
          }
          return {
            ...m,
            status: "forfeit" as const,
            forfeitTeamId,
            winnerTeamId: winnerId,
            scoreTeamA: scoreA,
            scoreTeamB: scoreB,
            lockedByAdmin: true,
            updatedByRole: "admin" as const,
            updatedAtLabel: formatStoreTimeLabel(),
          };
        });
        updatedMatches = propagateKnockoutWinners(updatedMatches);
      }

      return {
        ...prev,
        alerts: updatedAlerts,
        teams: updatedTeams,
        matches: updatedMatches,
      };
    });

    await dispatchAdminControlApi({
      action: "handle_referee_alert",
      tournamentId: state.tournament.id,
      alertId,
      resolution,
      matchId: targetAlert?.matchId,
      forfeitTeamId: targetAlert?.requestingTeamId ?? null,
    });

    setFeedback({
      message: `Alerte Table ${targetAlert?.tableNumber ?? ""} traitée (${resolution}).`,
      tone: "ok",
    });
  }

  async function handlePushLiveAnnouncement(params: {
    matchId: string;
    tableNumber: number;
    teamId: string | null;
    teamNameSnapshot: string;
    announcementType: AnnouncementType;
    phase: LivePopupPhase;
    pointsAwarded: number | null;
  }) {
    broadcastLiveAnnouncementFromStore({
      announcementId: `admin-ann-${Date.now()}`,
      matchId: params.matchId,
      tableNumber: params.tableNumber,
      teamId: params.teamId,
      teamName: params.teamNameSnapshot,
      opponentName: null,
      announcementType: params.announcementType,
      phase: params.phase,
      pointsAwarded: params.pointsAwarded,
      contractNote: "Diffusé depuis le poste Administrateur",
    });

    await dispatchAdminControlApi({
      action: "push_live_announcement",
      tournamentId: state.tournament.id,
      ...params,
    });

    setFeedback({
      message: `Pop-up diffusé en direct vers /live : Table ${params.tableNumber} · ${params.teamNameSnapshot} (${params.announcementType}).`,
      tone: "ok",
    });
  }

  function handleImportTeams(
    rows: RawImportedTeamRow[],
    mode: "replace" | "append",
  ) {
    adminImportTeamsIntoStore(rows, mode);
    setFeedback({
      message: `${rows.length} binômes importés dans la liste de check-in 18h30.`,
      tone: "ok",
    });
  }

  function handleToggleTeamCheckin(teamId: string) {
    updateUnifiedTournamentState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => {
        if (t.id === teamId) {
          return { ...t, checkedIn: !t.checkedIn };
        }
        return t;
      }),
    }));
  }

  function handleCheckInAllTeams(checked: boolean) {
    updateUnifiedTournamentState((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => ({ ...t, checkedIn: checked })),
    }));
  }

  function handleAddManualTeam(params: {
    teamName: string;
    player1Name: string;
    player2Name: string;
  }) {
    const cleanP1 = sanitizePlainName(params.player1Name);
    const cleanP2 = sanitizePlainName(params.player2Name);
    let cleanName = sanitizePlainName(params.teamName);
    if (cleanName.length === 0) {
      cleanName = formatPlayersPrimaryName(cleanP1, cleanP2);
    }
    const primaryLabel = formatPlayersPrimaryName(cleanP1, cleanP2);

    updateUnifiedTournamentState((prev) => {
      const nextSeed = prev.teams.length + 1;
      return {
        ...prev,
        teams: [
          ...prev.teams,
          {
            id: `team-manual-${Date.now()}`,
            shortCode: `M${String(nextSeed).padStart(2, "0")}`,
            teamName: cleanName,
            normalizedName: normalizeComparisonKey(cleanName),
            player1Name: cleanP1,
            player2Name: cleanP2,
            promotionLabel: "ENSEIRB-MATMECA",
            checkedIn: true,
            isForfeit: false,
            seedOrder: nextSeed,
            player1LinkedAccount: null,
            player2LinkedAccount: null,
          },
        ],
      };
    });

    setFeedback({
      message: `Binôme "${primaryLabel}" ajouté et pointé au check-in.`,
      tone: "ok",
    });
  }

  function handleUpdateTeamDetails(params: {
    teamId: string;
    teamName: string;
    player1Name: string;
    player2Name: string;
    checkedIn: boolean;
    isForfeit: boolean;
  }) {
    adminUpdateTeamDetailsInStore(params);
    const primaryLabel = formatPlayersPrimaryName(
      params.player1Name,
      params.player2Name,
    );
    setFeedback({
      message: `Binôme "${primaryLabel}" mis à jour sur tous les écrans.`,
      tone: "ok",
    });
  }

  function handleRemoveTeam(teamId: string) {
    updateUnifiedTournamentState((prev) => ({
      ...prev,
      teams: prev.teams.filter((t) => t.id !== teamId),
    }));
  }

  function handleResetTournament() {
    adminResetTournamentInStore();
    setFeedback({
      message:
        "Tournoi remis à zéro (0 équipe, 0 match, phase Check-in avant 18h30). Ajoutez vos joueurs ou importez votre feuille Google Sheets !",
      tone: "ok",
    });
  }

  if (!isServerAuthenticated) {
    let submitBtnLabel = "Déverrouiller le Poste Administrateur";
    if (loginLoading) {
      submitBtnLabel = "Vérification cryptographique scrypt en cours...";
    }

    return (
      <div className="container-mobile" style={{ paddingTop: "24px" }}>
        <section className="card-ruled">
          <span className="eyebrow">
            <LockIcon size={13} />
            <span>Accès restreint Bureau · Protection multi-facteurs</span>
          </span>

          <h1 className="section-title" style={{ marginTop: "6px" }}>
            Authentification Administrateur Coinch&apos;Eirb
          </h1>

          <p
            style={{
              margin: "8px 0 14px",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Cette zone est réservée au Bureau Coinch&apos;Eirb. Saisissez
            l&apos;identifiant Bureau, le mot de passe maître et le code PIN de
            sécurité pour déverrouiller le poste de pilotage. Après 4 échecs,
            l&apos;adresse IP est bloquée pendant 30 minutes.
          </p>

          <form
            onSubmit={handleUnlockAdminSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            noValidate
          >
            {/* Champ Honeypot invisible contre les robots et scanners */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: "1px",
                height: "1px",
                overflow: "hidden",
              }}
            >
              <label htmlFor="admin-website-hp">Ne pas remplir</label>
              <input
                id="admin-website-hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={loginHoneypot}
                onChange={(e) => setLoginHoneypot(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="admin-unlock-identifier" className="field-label">
                1. Identifiant Bureau (ou Email Admin)
              </label>
              <input
                id="admin-unlock-identifier"
                type="text"
                className="field-input"
                placeholder="Identifiant Bureau Coinch'Eirb"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-unlock-password" className="field-label">
                2. Mot de passe maître Administrateur
              </label>
              <input
                id="admin-unlock-password"
                type="password"
                className="field-input"
                placeholder="Mot de passe maître (vérifié par scrypt)"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-unlock-pin" className="field-label">
                3. Code PIN de sécurité Bureau (6 chiffres)
              </label>
              <input
                id="admin-unlock-pin"
                type="password"
                inputMode="numeric"
                className="field-input"
                placeholder="Code PIN Bureau à 6 chiffres"
                maxLength={16}
                value={loginPinCode}
                onChange={(e) => setLoginPinCode(e.target.value)}
                autoComplete="one-time-code"
                required
              />
            </div>

            {loginError !== null && (
              <div className="banner banner-fail" role="alert">
                <AlertTriangleIcon
                  size={16}
                  style={{ flexShrink: 0, marginTop: "1px" }}
                />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loginLoading}
            >
              <LockIcon size={17} />
              <span>{submitBtnLabel}</span>
            </button>

            <Link href="/" className="btn btn-secondary btn-full">
              <span>Retourner à l&apos;accueil public</span>
            </Link>
          </form>
        </section>
      </div>
    );
  }

  const checkedInCount = state.teams.filter(
    (t) => t.checkedIn && !t.isForfeit,
  ).length;
  const openAlertsCount = state.alerts.filter(
    (a) => a.status !== "resolved",
  ).length;

  return (
    <div className="admin-shell">
      <AdminControlHeader
        tournament={state.tournament}
        checkedInCount={checkedInCount}
        totalTeamCount={state.teams.length}
        openAlertsCount={openAlertsCount}
        adminDisplayName={adminDisplayName}
        syncMode={syncMode}
        syncRevision={syncRevision}
        isSubmitting={isSubmitting}
        onAdminLogout={handleAdminLogout}
        onUpdateTournamentTitle={(nextTitle: string) => {
          updateUnifiedTournamentState((prev) => ({
            ...prev,
            tournament: {
              ...prev.tournament,
              title: sanitizePlainName(nextTitle),
            },
          }));
          setFeedback({
            message: `Titre de la soirée mis à jour : "${nextTitle}".`,
            tone: "ok",
          });
        }}
        onTogglePlayerScoreEditing={handleTogglePlayerScoreEditing}
        onGeneratePools={handleGeneratePools}
        onAdvanceToKnockout={handleAdvanceToKnockout}
        onSetTournamentPhase={(nextStatus: TournamentStatus) => {
          updateUnifiedTournamentState((prev) => ({
            ...prev,
            tournament: { ...prev.tournament, status: nextStatus },
          }));
        }}
        onThresholdChange={(nextThreshold: number) => {
          updateUnifiedTournamentState((prev) => ({
            ...prev,
            tournament: {
              ...prev.tournament,
              roundOf16Threshold: nextThreshold,
            },
          }));
        }}
        onResetTournament={handleResetTournament}
      />

      {feedback !== null && (
        <div
          className="admin-feedback-banner"
          data-tone={feedback.tone}
          role="status"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => setFeedback(null)}
          >
            <span>Fermer</span>
          </button>
        </div>
      )}

      <div className="admin-cockpit-grid">
        <div className="admin-col">
          <AdminRefereeAlertsPanel
            alerts={state.alerts}
            onHandleAlert={handleRefereeAlert}
          />

          <AdminPosterAndKnockoutPanel
            tournament={state.tournament}
            standings={summary.poolStandings}
            qualification={summary.qualification}
            onPosterUpdated={(posterMeta) => {
              updateUnifiedTournamentState((prev) => ({
                ...prev,
                tournament: {
                  ...prev.tournament,
                  posterUrl: posterMeta.posterUrl,
                  posterMimeLabel: posterMeta.mimeLabel,
                  posterSizeLabel: posterMeta.sizeLabel,
                },
              }));
            }}
            onWinnerPhotoUpdated={(winnerMeta) => {
              updateUnifiedTournamentState((prev) => ({
                ...prev,
                tournament: {
                  ...prev.tournament,
                  winnerPhotoUrl: winnerMeta.winnerPhotoUrl,
                  winnerPhotoCaption: winnerMeta.winnerPhotoCaption,
                },
              }));
              setFeedback({
                message:
                  "Photo du vainqueur diffusée en direct sur l'accueil, /classement et /live !",
                tone: "ok",
              });
            }}
          />
        </div>

        <div className="admin-col">
          <AdminPoolBuilderPanel
            teams={state.teams}
            pools={state.pools}
            hasScoredPoolMatches={state.matches.some(
              (m) => m.phase === "pool" && (m.scoreTeamA > 0 || m.scoreTeamB > 0),
            )}
            onApplyManualPools={(poolTeamIds, summaryLabel) => {
              try {
                const updated = adminApplyManualPoolsInStore(poolTeamIds);
                setFeedback({
                  message: `Poules appliquées (${summaryLabel}) · ${updated.matches.length} matchs créés et synchronisés sur /ma-table, /classement et /live !`,
                  tone: "ok",
                });
              } catch (err) {
                let msg = "Impossible d'appliquer ces poules.";
                if (err instanceof Error) {
                  msg = err.message;
                }
                setFeedback({ message: msg, tone: "error" });
              }
            }}
          />

          <AdminTablesLiveGrid
            matches={state.matches}
            teams={state.teams}
            liveFeed={state.liveFeed}
            onForceUpdateMatch={handleForceUpdateMatch}
            onUndoLastDeal={(matchId: string) => {
              adminUndoLastDealInStore(matchId);
              setFeedback({
                message: "Dernière donne annulée et score recalculé.",
                tone: "ok",
              });
            }}
            onPushLiveAnnouncement={handlePushLiveAnnouncement}
          />
        </div>

        <div className="admin-col">
          <AdminCheckinImportPanel
            teams={state.teams}
            registrationsLocked={state.tournament.registrationsLocked}
            onImportTeams={handleImportTeams}
            onToggleTeamCheckin={handleToggleTeamCheckin}
            onCheckInAllTeams={handleCheckInAllTeams}
            onAddManualTeam={handleAddManualTeam}
            onUpdateTeamDetails={handleUpdateTeamDetails}
            onRemoveTeam={handleRemoveTeam}
          />
        </div>
      </div>
    </div>
  );
}
