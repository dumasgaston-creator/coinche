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
  submitTableAlertToStore,
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
  CheckIcon,
  LockIcon,
} from "@/components/icons/Icons";

interface MeAuthPayload {
  profile: {
    id: string;
    displayName: string;
    role: "player" | "admin";
    schoolYear: string;
  } | null;
  devBootstrapHintAvailable?: boolean;
}

interface AdminDashboardClientProps {
  initialIsAdmin?: boolean;
  initialAdminName?: string;
  initialDevHintAvailable?: boolean;
}

/**
 * Poste de pilotage Administrateur (`/admin`) :
 * - Protege par mot de passe verifie cote serveur (`/api/auth/admin/login`, scrypt + cookie `httpOnly` signe)
 * - Etat de session pre-verifie en SSR pour zero ecran de blocage au chargement
 * - Relie au store temps reel partage avec `/ma-table`, `/classement`, `/equipe` et `/live`.
 */
export function AdminDashboardClient(props: AdminDashboardClientProps) {
  const { state, summary, syncMode, syncRevision } = useTournamentStore();

  const [isServerAuthenticated, setIsServerAuthenticated] = useState<boolean>(
    props.initialIsAdmin === true,
  );
  const [adminDisplayName, setAdminDisplayName] = useState<string>(
    props.initialAdminName ?? "Bureau Coinch'Eirb",
  );
  const [devHintAvailable, setDevHintAvailable] = useState<boolean>(
    props.initialDevHintAvailable === true,
  );

  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
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
            if (data.devBootstrapHintAvailable === true) {
              setDevHintAvailable(true);
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
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        authenticated?: boolean;
        profile?: { displayName?: string };
        error?: string;
      } | null;

      if (!res.ok) {
        let msg = "Mot de passe administrateur refusé.";
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

  function handleSimulateIncomingAlert(
    alertType: "referee_call" | "abandon_request",
  ) {
    const sampleTeam = state.teams[3] ?? {
      id: "team-04",
      teamName: "Capot Royal",
    };
    let msg =
      "Appel arbitre : question sur une parlante signalée à la Table 2 (160 pts).";
    if (alertType === "abandon_request") {
      msg =
        "Abandon double-confirmé par l'équipe depuis le téléphone de la table.";
    }

    submitTableAlertToStore({
      matchId: state.matches[1]?.id ?? "match-pool-1-r1-t2",
      tableNumber: state.matches[1]?.tableNumber ?? 2,
      teamId: sampleTeam.id,
      teamName: sampleTeam.teamName,
      alertType,
      message: msg,
      applyImmediateForfeit: false,
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

  function handleResetTournament(
    mode: "demo" | "clean_checkin",
    demoTeamCount: number = 20,
  ) {
    const next = adminResetTournamentInStore(mode, demoTeamCount);
    if (mode === "clean_checkin") {
      setFeedback({
        message:
          "Tournoi remis à zéro (phase Check-in avant 18h30, 0 point). Importez autant d'équipes que vous voulez !",
        tone: "ok",
      });
    } else {
      setFeedback({
        message: `Tournoi test généré avec ${next.teams.length} équipes réparties en ${next.pools.length} poules.`,
        tone: "ok",
      });
    }
  }

  if (!isServerAuthenticated) {
    let submitBtnLabel = "Déverrouiller le Poste Admin";
    if (loginLoading) {
      submitBtnLabel = "Vérification scrypt côté serveur...";
    }

    return (
      <div className="container-mobile" style={{ paddingTop: "24px" }}>
        <section className="card-ruled">
          <span className="eyebrow">
            <LockIcon size={13} />
            <span>Accès protégé · Vérification serveur obligatoire</span>
          </span>

          <h1 className="section-title" style={{ marginTop: "6px" }}>
            Déverrouillage Poste Administrateur
          </h1>

          <p
            style={{
              margin: "8px 0 14px",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Entrez le mot de passe administrateur Coinch&apos;Eirb pour accéder
            à l&apos;édition forcée des scores, à la gestion des équipes, au
            tirage des poules et au passage aux Huitièmes de finale.
          </p>

          {devHintAvailable && (
            <div
              className="banner banner-info"
              style={{ marginBottom: "14px", flexDirection: "column", gap: "6px" }}
            >
              <div>
                <strong>Mode développement local détecté :</strong> aucun hash{" "}
                <code>ADMIN_BOOTSTRAP_PASSWORD_HASH</code> personnalisé
                n&apos;est encore défini dans <code>.env.local</code>.
              </div>
              <div style={{ fontSize: "12.5px" }}>
                Mot de passe local actif :{" "}
                <code>CoincheEirb2026!</code>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => setLoginPassword("CoincheEirb2026!")}
              >
                <CheckIcon size={14} />
                <span>Pré-remplir le mot de passe de test local</span>
              </button>
            </div>
          )}

          <form
            onSubmit={handleUnlockAdminSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            noValidate
          >
            <div>
              <label htmlFor="admin-unlock-password" className="field-label">
                Mot de passe administrateur
              </label>
              <input
                id="admin-unlock-password"
                type="password"
                className="field-input"
                placeholder="Mot de passe maître Coinch'Eirb"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-unlock-email" className="field-label">
                Email admin Supabase (optionnel si mot de passe maître utilisé)
              </label>
              <input
                id="admin-unlock-email"
                type="email"
                className="field-input"
                placeholder="bureau@coincheirb.fr (facultatif)"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
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

            <Link href="/ma-table" className="btn btn-secondary btn-full">
              <span>Retourner aux tables joueurs</span>
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
            onSimulateIncomingAlert={handleSimulateIncomingAlert}
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
