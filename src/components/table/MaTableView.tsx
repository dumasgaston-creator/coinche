"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AnnouncementOutcome, AnnouncementType } from "@/types/database";
import { normalizeComparisonKey } from "@/lib/security/sanitize";
import {
  broadcastLiveAnnouncementFromStore,
  editDealInStore,
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  recordDealInStore,
  recordDirectFinalScoreInStore,
  submitTableAlertToStore,
  type UnifiedMatchRecord,
} from "@/lib/tournament/live-store";
import {
  clearMyTeamIdFromStorage,
  readMyTeamIdFromStorage,
  resolveTeamMatchTimeline,
  saveMyTeamIdToStorage,
  searchTeamsByFirstName,
} from "@/lib/tournament/player-lookup";
import { evaluateMatchProgress } from "@/lib/tournament/scoring";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import { AnnouncementPanel } from "@/components/table/AnnouncementPanel";
import { ScoreHistoryList } from "@/components/table/ScoreHistoryList";
import { AbandonModal, RefereeModal } from "@/components/table/ActionModals";
import type {
  PendingLiveAnnouncement,
  TableDealItem,
  TableTeamInfo,
  TeamSide,
} from "@/components/table/types";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BellAlertIcon,
  CheckIcon,
  FlagIcon,
  LockIcon,
  ProjectorScreenIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons/Icons";

type EntryMode = "deal" | "direct";

const SELECTED_MATCH_STORAGE_KEY = "coincheirb-active-match-id";
const QUICK_POINTS: readonly number[] = [80, 90, 100, 110, 120, 160, 250, 320];

function parseNonNegativeInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return 0;
  }
  if (!/^[0-9]+$/.test(trimmed)) {
    return null;
  }
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value) || value < 0 || value > 5000) {
    return null;
  }
  return value;
}

function getAnnouncementLabel(type: AnnouncementType): string {
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

function formatCurrentTimeLabel(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}h${minutes}`;
}

function formatMatchContextBadge(match: UnifiedMatchRecord): string {
  if (match.phase === "pool") {
    if (match.poolLabel !== null) {
      return `${match.poolLabel} · Tour ${match.roundNumber}`;
    }
    return `Poules · Tour ${match.roundNumber}`;
  }
  if (match.phase === "round_of_16") {
    return `8e de finale #${match.bracketSlot ?? 1} · 500 pts`;
  }
  if (match.phase === "quarterfinals") {
    return `Quart #${match.bracketSlot ?? 1} · 600 pts`;
  }
  if (match.phase === "semifinals") {
    return `Demi-finale #${match.bracketSlot ?? 1} · 700 pts`;
  }
  return "Finale · 1000 pts";
}

/**
 * Ecran mobile complet « Ma table » (1 seul telephone par table) :
 * - Relie en temps reel au store partage (`/classement`, `/live`, `/admin`, `/equipe`)
 * - Selecteur rapide de table (Tables 1..10 en Poules ou matchs de l'Arbre Final)
 * - Lecture automatique de `?table=` ou `?equipe=` depuis l'accueil / `/equipe`
 * - Saisie par donne, mode score final direct, annonces vers `/live`, appel arbitre et abandon vers `/admin`.
 */
export function MaTableView() {
  const searchParams = useSearchParams();
  const { state, summary, hydrated } = useTournamentStore();

  const playableMatches = useMemo(() => {
    return state.matches
      .filter(
        (m) =>
          m.status !== "bye" && m.teamAId !== null && m.teamBId !== null,
      )
      .sort((a, b) => {
        let rankA = 1;
        if (a.status === "in_progress") {
          rankA = 0;
        } else if (a.status === "completed" || a.status === "forfeit") {
          rankA = 2;
        }
        let rankB = 1;
        if (b.status === "in_progress") {
          rankB = 0;
        } else if (b.status === "completed" || b.status === "forfeit") {
          rankB = 2;
        }
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        return (a.tableNumber ?? 99) - (b.tableNumber ?? 99);
      });
  }, [state.matches]);

  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [firstNameInput, setFirstNameInput] = useState<string>("");
  const [showFirstNamePicker, setShowFirstNamePicker] = useState<boolean>(false);
  const [entryMode, setEntryMode] = useState<EntryMode>("deal");

  const [inputA, setInputA] = useState<string>("");
  const [inputB, setInputB] = useState<string>("");
  const [quickTargetSide, setQuickTargetSide] = useState<TeamSide>("team_a");
  const [parlantePenalty, setParlantePenalty] = useState<boolean>(false);
  const [editingDealId, setEditingDealId] = useState<string | null>(null);

  const [directInputA, setDirectInputA] = useState<string>("");
  const [directInputB, setDirectInputB] = useState<string>("");

  const [announcementSide, setAnnouncementSide] = useState<TeamSide>("team_a");
  const [pendingAnnouncement, setPendingAnnouncement] =
    useState<PendingLiveAnnouncement | null>(null);
  const [resolvedAnnouncementForDeal, setResolvedAnnouncementForDeal] =
    useState<{
      type: AnnouncementType;
      outcome: AnnouncementOutcome;
    } | null>(null);
  const [lastLiveFeedMessage, setLastLiveFeedMessage] = useState<string | null>(
    null,
  );

  const [refereeModalOpen, setRefereeModalOpen] = useState<boolean>(false);
  const [refereeAlertMessage, setRefereeAlertMessage] = useState<string | null>(
    null,
  );
  const [abandonModalOpen, setAbandonModalOpen] = useState<boolean>(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  // Resolution de la table a partir de `?team=`, `?match=`, `?table=`, `?equipe=` ou du prenom sauvegarde
  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const teamParam = searchParams.get("team");
    const matchParam = searchParams.get("match");
    const tableParam = searchParams.get("table");
    const equipeParam = searchParams.get("equipe");

    let resolvedTeamId = readMyTeamIdFromStorage();
    if (resolvedTeamId !== null && findUnifiedTeam(state.teams, resolvedTeamId) === null) {
      resolvedTeamId = null;
    }

    if (teamParam !== null && teamParam.trim().length > 0) {
      const exactTeam = findUnifiedTeam(state.teams, teamParam.trim());
      if (exactTeam !== null) {
        resolvedTeamId = exactTeam.id;
        saveMyTeamIdToStorage(exactTeam.id);
      }
    } else if (equipeParam !== null && equipeParam.trim().length > 0) {
      const foundList = searchTeamsByFirstName(state.teams, equipeParam);
      if (foundList[0] !== undefined) {
        resolvedTeamId = foundList[0].team.id;
        saveMyTeamIdToStorage(foundList[0].team.id);
      }
    }

    if (resolvedTeamId !== null && myTeamId !== resolvedTeamId) {
      setMyTeamId(resolvedTeamId);
    }

    if (playableMatches.length === 0) {
      return;
    }

    if (matchParam !== null && matchParam.trim().length > 0) {
      const exact = playableMatches.find((m) => m.id === matchParam.trim());
      if (exact !== undefined) {
        setSelectedMatchId(exact.id);
        return;
      }
    }

    if (tableParam !== null && /^[0-9]+$/.test(tableParam.trim())) {
      const num = Number.parseInt(tableParam.trim(), 10);
      const byTable = playableMatches.find((m) => m.tableNumber === num);
      if (byTable !== undefined) {
        setSelectedMatchId(byTable.id);
        return;
      }
    }

    if (resolvedTeamId !== null && selectedMatchId === "") {
      const timeline = resolveTeamMatchTimeline(
        resolvedTeamId,
        state.matches,
        state.teams,
      );
      if (timeline.currentMatch !== null) {
        setSelectedMatchId(timeline.currentMatch.id);
        return;
      }
    }

    if (equipeParam !== null && equipeParam.trim().length > 0) {
      const q = normalizeComparisonKey(equipeParam);
      const matchedTeam = state.teams.find((t) => {
        const codeNorm = normalizeComparisonKey(t.shortCode);
        const nameNorm = t.normalizedName;
        const p1Norm = normalizeComparisonKey(t.player1Name);
        const p2Norm = normalizeComparisonKey(t.player2Name);
        return (
          codeNorm === q ||
          nameNorm.includes(q) ||
          p1Norm.includes(q) ||
          p2Norm.includes(q)
        );
      });

      if (matchedTeam !== undefined) {
        const timeline = resolveTeamMatchTimeline(
          matchedTeam.id,
          state.matches,
          state.teams,
        );
        if (timeline.currentMatch !== null) {
          setSelectedMatchId(timeline.currentMatch.id);
          return;
        }
      }
    }

    try {
      const storedId = window.localStorage.getItem(SELECTED_MATCH_STORAGE_KEY);
      if (storedId !== null && selectedMatchId === "") {
        const foundStored = playableMatches.find((m) => m.id === storedId);
        if (foundStored !== undefined) {
          setSelectedMatchId(foundStored.id);
          return;
        }
      }
    } catch {
      // Ignore
    }

    const firstDefault = playableMatches[0];
    if (firstDefault !== undefined && selectedMatchId === "") {
      setSelectedMatchId(firstDefault.id);
    }
  }, [
    hydrated,
    playableMatches,
    searchParams,
    state.teams,
    state.matches,
    selectedMatchId,
    myTeamId,
  ]);

  const myTeamRecord = useMemo(() => {
    if (myTeamId === null) {
      return null;
    }
    return findUnifiedTeam(state.teams, myTeamId);
  }, [myTeamId, state.teams]);

  const myTimeline = useMemo(() => {
    if (myTeamRecord === null) {
      return null;
    }
    return resolveTeamMatchTimeline(myTeamRecord.id, state.matches, state.teams);
  }, [myTeamRecord, state.matches, state.teams]);

  const firstNameSuggestions = useMemo(() => {
    if (firstNameInput.trim().length < 1) {
      return [];
    }
    return searchTeamsByFirstName(state.teams, firstNameInput).slice(0, 6);
  }, [state.teams, firstNameInput]);

  function handleSelectMyTeam(teamId: string) {
    setMyTeamId(teamId);
    saveMyTeamIdToStorage(teamId);
    setFirstNameInput("");
    setShowFirstNamePicker(false);
    const timeline = resolveTeamMatchTimeline(teamId, state.matches, state.teams);
    if (timeline.currentMatch !== null) {
      handleChangeSelectedMatch(timeline.currentMatch.id);
    }
  }

  function handleChangeSelectedMatch(nextId: string) {
    setSelectedMatchId(nextId);
    setEditingDealId(null);
    setInputA("");
    setInputB("");
    setFormError(null);
    setFormNotice(null);
    setPendingAnnouncement(null);
    try {
      window.localStorage.setItem(SELECTED_MATCH_STORAGE_KEY, nextId);
    } catch {
      // Ignore
    }
  }

  let activeMatch: UnifiedMatchRecord | null = null;
  for (const m of playableMatches) {
    if (m.id === selectedMatchId) {
      activeMatch = m;
      break;
    }
  }
  if (activeMatch === null && playableMatches[0] !== undefined) {
    activeMatch = playableMatches[0];
  }

  if (activeMatch === null) {
    return (
      <div className="container-mobile">
        <section className="card-ruled">
          <span className="eyebrow">En attente du tirage</span>
          <h1 className="section-title" style={{ marginTop: "6px" }}>
            Aucune table active pour le moment
          </h1>
          <p
            style={{
              margin: "8px 0 14px",
              fontSize: "13.5px",
              color: "var(--ink-secondary)",
            }}
          >
            Le tournoi est actuellement en phase de check-in. Dès que
            l&apos;administrateur valide et génère les poules, toutes les tables
            apparaissent automatiquement ici.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Link href="/admin" className="btn btn-primary btn-full">
              <LockIcon size={16} />
              <span>Ouvrir le Poste Admin pour générer les poules</span>
            </Link>
            <Link href="/classement" className="btn btn-secondary btn-full">
              <TrophyIcon size={16} />
              <span>Voir le classement</span>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const teamARecord = findUnifiedTeam(state.teams, activeMatch.teamAId);
  const teamBRecord = findUnifiedTeam(state.teams, activeMatch.teamBId);

  const teamAP1 = teamARecord?.player1Name ?? "Joueur 1";
  const teamAP2 = teamARecord?.player2Name ?? "Joueur 2";
  const teamBP1 = teamBRecord?.player1Name ?? "Joueur 1";
  const teamBP2 = teamBRecord?.player2Name ?? "Joueur 2";

  const teamAInfo: TableTeamInfo = {
    id: teamARecord?.id ?? "team-a",
    name: formatPlayersPrimaryName(teamAP1, teamAP2),
    nickname: formatOptionalTeamNickname(
      teamARecord?.teamName ?? "",
      teamAP1,
      teamAP2,
    ),
    player1: teamAP1,
    player2: teamAP2,
  };

  const teamBInfo: TableTeamInfo = {
    id: teamBRecord?.id ?? "team-b",
    name: formatPlayersPrimaryName(teamBP1, teamBP2),
    nickname: formatOptionalTeamNickname(
      teamBRecord?.teamName ?? "",
      teamBP1,
      teamBP2,
    ),
    player1: teamBP1,
    player2: teamBP2,
  };

  const deals: TableDealItem[] = activeMatch.deals;
  const totalScoreA = activeMatch.scoreTeamA;
  const totalScoreB = activeMatch.scoreTeamB;
  const tableNumber = activeMatch.tableNumber ?? 1;

  const isLockedByAdminSwitch =
    !state.tournament.playerScoreEditingEnabled || activeMatch.lockedByAdmin;

  const matchProgress = evaluateMatchProgress({
    phase: activeMatch.phase,
    scoreTeamA: totalScoreA,
    scoreTeamB: totalScoreB,
    dealsPlayed: activeMatch.dealsPlayed,
    dealsPerPoolMatch: state.tournament.dealsPerPoolMatch,
    targetScore: activeMatch.targetScore,
    isDirectFinalScore: activeMatch.isDirectFinalScore,
  });

  const isForfeited = activeMatch.status === "forfeit";
  const isMatchClosed =
    isForfeited ||
    activeMatch.status === "completed" ||
    matchProgress.status === "completed";
  const isInputDisabled =
    isLockedByAdminSwitch || (isMatchClosed && editingDealId === null);

  const nextDealNumber = deals.length + 1;

  let teamALeading = "false";
  let teamBLeading = "false";
  if (totalScoreA > totalScoreB) {
    teamALeading = "true";
  } else if (totalScoreB > totalScoreA) {
    teamBLeading = "true";
  }

  let statusBadgeText = "Match en cours";
  let statusBadgeClass = "badge badge-amber";
  if (isForfeited) {
    statusBadgeText = "Terminé · Abandon";
    statusBadgeClass = "badge badge-fail";
  } else if (isMatchClosed) {
    statusBadgeText = "Match terminé";
    statusBadgeClass = "badge badge-pass";
  } else if (matchProgress.requiresTiebreakerDeal) {
    statusBadgeText = "Égalité · 6e donne";
    statusBadgeClass = "badge badge-terracotta";
  }

  function handleQuickChip(value: number) {
    if (isInputDisabled) {
      return;
    }
    setFormError(null);
    if (quickTargetSide === "team_a") {
      setInputA(String(value));
      if (inputB === "") {
        setInputB("0");
      }
    } else {
      setInputB(String(value));
      if (inputA === "") {
        setInputA("0");
      }
    }
  }

  function handleDealSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeMatch === null) {
      return;
    }
    setFormError(null);
    setFormNotice(null);

    if (isLockedByAdminSwitch) {
      setFormError(
        "La saisie des scores est actuellement verrouillée par l'administrateur.",
      );
      return;
    }

    if (isMatchClosed && editingDealId === null) {
      setFormError(
        "Ce match est terminé. Cliquez sur Modifier sur une donne de l'historique si besoin.",
      );
      return;
    }

    const parsedA = parseNonNegativeInt(inputA);
    const parsedB = parseNonNegativeInt(inputB);

    if (parsedA === null || parsedB === null) {
      setFormError(
        "Saisissez uniquement des nombres entiers positifs (ex. 110 et 0).",
      );
      return;
    }

    if (parsedA === 0 && parsedB === 0) {
      setFormError(
        "Au moins une des deux équipes doit marquer des points sur la donne.",
      );
      return;
    }

    if (editingDealId !== null) {
      editDealInStore({
        matchId: activeMatch.id,
        dealId: editingDealId,
        pointsTeamA: parsedA,
        pointsTeamB: parsedB,
        parlantePenalty,
      });
      setFormNotice(
        "Donne mise à jour · Classement des poules, arbre et /live synchronisés.",
      );
      setEditingDealId(null);
      setInputA("");
      setInputB("");
      setParlantePenalty(false);
      return;
    }

    let specialType: AnnouncementType | null = null;
    let specialOutcome: AnnouncementOutcome | null = null;
    if (resolvedAnnouncementForDeal !== null) {
      specialType = resolvedAnnouncementForDeal.type;
      specialOutcome = resolvedAnnouncementForDeal.outcome;
    }

    recordDealInStore({
      matchId: activeMatch.id,
      pointsTeamA: parsedA,
      pointsTeamB: parsedB,
      specialAnnouncement: specialType,
      announcementOutcome: specialOutcome,
      parlantePenalty,
    });

    setInputA("");
    setInputB("");
    setParlantePenalty(false);
    setResolvedAnnouncementForDeal(null);
    setFormNotice(
      `Donne ${nextDealNumber} enregistrée · Poules, arbre et écran /live mis à jour en direct.`,
    );
  }

  function handleDirectScoreSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeMatch === null) {
      return;
    }
    setFormError(null);
    setFormNotice(null);

    if (isLockedByAdminSwitch) {
      setFormError(
        "La saisie des scores est actuellement verrouillée par l'administrateur.",
      );
      return;
    }

    const parsedA = parseNonNegativeInt(directInputA);
    const parsedB = parseNonNegativeInt(directInputB);

    if (parsedA === null || parsedB === null) {
      setFormError("Saisissez deux scores finaux valides.");
      return;
    }

    if (parsedA === 0 && parsedB === 0) {
      setFormError("Saisissez le score final réel du match.");
      return;
    }

    if (parsedA === parsedB) {
      setFormError(
        "Un score final direct ne peut pas être une égalité : jouez une donne de départage.",
      );
      return;
    }

    recordDirectFinalScoreInStore({
      matchId: activeMatch.id,
      scoreTeamA: parsedA,
      scoreTeamB: parsedB,
    });
    setDirectInputA("");
    setDirectInputB("");
    setFormNotice(
      "Score final enregistré · Classement des poules et arbre des phases finales mis à jour.",
    );
  }

  function handleStartEditDeal(deal: TableDealItem) {
    if (isLockedByAdminSwitch) {
      setFormError(
        "Modification désactivée par l'administrateur sur cette table.",
      );
      return;
    }
    setEntryMode("deal");
    setEditingDealId(deal.id);
    setInputA(String(deal.pointsTeamA));
    setInputB(String(deal.pointsTeamB));
    setParlantePenalty(deal.parlantePenalty);
    setFormError(null);
    setFormNotice(`Modification de la donne ${deal.dealNumber} en cours.`);
  }

  function handleCancelEdit() {
    setEditingDealId(null);
    setInputA("");
    setInputB("");
    setParlantePenalty(false);
    setFormNotice(null);
  }

  function handleTriggerAnnouncement(type: AnnouncementType) {
    if (activeMatch === null || isLockedByAdminSwitch) {
      return;
    }
    let chosenTeamId = teamAInfo.id;
    let chosenTeamName = teamAInfo.name;
    let opponentName = teamBInfo.name;

    if (announcementSide === "team_b") {
      chosenTeamId = teamBInfo.id;
      chosenTeamName = teamBInfo.name;
      opponentName = teamAInfo.name;
    }

    const annId = `ann-${Date.now()}`;
    const nextPending: PendingLiveAnnouncement = {
      id: annId,
      type,
      teamSide: announcementSide,
      teamName: chosenTeamName,
      sentAtLabel: formatCurrentTimeLabel(),
    };

    setPendingAnnouncement(nextPending);
    setLastLiveFeedMessage(null);

    broadcastLiveAnnouncementFromStore({
      announcementId: annId,
      matchId: activeMatch.id,
      tableNumber,
      teamId: chosenTeamId,
      teamName: chosenTeamName,
      opponentName,
      announcementType: type,
      phase: "announced",
      pointsAwarded: null,
      contractNote: `Table ${tableNumber} · ${formatMatchContextBadge(activeMatch)}`,
    });
  }

  function handleResolveAnnouncement(outcome: "passed" | "failed") {
    if (pendingAnnouncement === null || activeMatch === null) {
      return;
    }

    const label = getAnnouncementLabel(pendingAnnouncement.type);
    let outcomeLabel = "PASSÉ";
    if (outcome === "failed") {
      outcomeLabel = "CHUTÉ";
    }

    let chosenTeamId = teamAInfo.id;
    let opponentName = teamBInfo.name;
    if (pendingAnnouncement.teamSide === "team_b") {
      chosenTeamId = teamBInfo.id;
      opponentName = teamAInfo.name;
    }

    let awarded: number | null = null;
    if (outcome === "passed") {
      if (pendingAnnouncement.type === "capot") {
        awarded = 250;
      } else if (pendingAnnouncement.type === "generale") {
        awarded = 500;
      } else if (pendingAnnouncement.type === "coinche") {
        awarded = 260;
      } else {
        awarded = 520;
      }
    } else {
      if (pendingAnnouncement.type === "coinche") {
        awarded = 320;
      } else if (pendingAnnouncement.type === "surcoinche") {
        awarded = 640;
      } else {
        awarded = 160;
      }
    }

    broadcastLiveAnnouncementFromStore({
      announcementId: pendingAnnouncement.id,
      matchId: activeMatch.id,
      tableNumber,
      teamId: chosenTeamId,
      teamName: pendingAnnouncement.teamName,
      opponentName,
      announcementType: pendingAnnouncement.type,
      phase: outcome,
      pointsAwarded: awarded,
      contractNote: `Table ${tableNumber} · ${formatMatchContextBadge(activeMatch)}`,
    });

    setResolvedAnnouncementForDeal({
      type: pendingAnnouncement.type,
      outcome,
    });

    if (outcome === "passed") {
      if (pendingAnnouncement.type === "capot") {
        if (pendingAnnouncement.teamSide === "team_a") {
          setInputA("250");
          setInputB("0");
        } else {
          setInputA("0");
          setInputB("250");
        }
      } else if (pendingAnnouncement.type === "generale") {
        if (pendingAnnouncement.teamSide === "team_a") {
          setInputA("500");
          setInputB("0");
        } else {
          setInputA("0");
          setInputB("500");
        }
      }
    } else if (
      pendingAnnouncement.type === "capot" ||
      pendingAnnouncement.type === "generale"
    ) {
      if (pendingAnnouncement.teamSide === "team_a") {
        setInputA("0");
        setInputB("160");
      } else {
        setInputA("160");
        setInputB("0");
      }
    }

    setLastLiveFeedMessage(
      `Pop-up diffusé en direct sur /live : ${label} ${outcomeLabel} (${pendingAnnouncement.teamName}). Validez la donne ci-dessus pour enregistrer les points.`,
    );
    setPendingAnnouncement(null);
  }

  function handleConfirmReferee(reason: string) {
    if (activeMatch === null) {
      return;
    }
    setRefereeModalOpen(false);
    submitTableAlertToStore({
      matchId: activeMatch.id,
      tableNumber,
      teamId: teamAInfo.id,
      teamName: `${teamAInfo.name} / ${teamBInfo.name}`,
      alertType: "referee_call",
      message: `Appel arbitre : ${reason}`,
      applyImmediateForfeit: false,
    });
    setRefereeAlertMessage(
      `Arbitre prévenu à ${formatCurrentTimeLabel()} (${reason}). L'alerte clignote sur le poste /admin · Restez à la table ${tableNumber}.`,
    );
  }

  function handleConfirmForfeit(side: TeamSide) {
    if (activeMatch === null) {
      return;
    }
    setAbandonModalOpen(false);
    let teamId = teamAInfo.id;
    let teamName = teamAInfo.name;
    if (side === "team_b") {
      teamId = teamBInfo.id;
      teamName = teamBInfo.name;
    }

    submitTableAlertToStore({
      matchId: activeMatch.id,
      tableNumber,
      teamId,
      teamName,
      alertType: "abandon_request",
      message: `Abandon double-confirmé par ${teamName} sur le téléphone de la Table ${tableNumber}.`,
      applyImmediateForfeit: true,
    });

    setFormNotice(
      `Abandon confirmé pour ${teamName}. Le poste Admin et les classements ont été mis à jour.`,
    );
  }

  let dealModeActive = "false";
  let directModeActive = "false";
  if (entryMode === "deal") {
    dealModeActive = "true";
  } else {
    directModeActive = "true";
  }

  let quickSideAActive = "false";
  let quickSideBActive = "false";
  let quickSideABorder = "var(--border-subtle)";
  let quickSideABg = "var(--bg-surface)";
  let quickSideBBorder = "var(--border-subtle)";
  let quickSideBBg = "var(--bg-surface)";
  if (quickTargetSide === "team_a") {
    quickSideAActive = "true";
    quickSideABorder = "var(--accent-amber)";
    quickSideABg = "var(--accent-amber-soft)";
  } else {
    quickSideBActive = "true";
    quickSideBBorder = "var(--accent-amber)";
    quickSideBBg = "var(--accent-amber-soft)";
  }

  let scoreboardLeftMeta = `${formatMatchContextBadge(activeMatch)}`;
  let scoreboardProgressText = `Donne ${Math.min(deals.length, state.tournament.dealsPerPoolMatch)} / ${state.tournament.dealsPerPoolMatch}`;
  if (activeMatch.targetScore !== null) {
    scoreboardLeftMeta = formatMatchContextBadge(activeMatch);
    scoreboardProgressText = `Objectif ${activeMatch.targetScore} pts`;
  } else if (activeMatch.isDirectFinalScore) {
    scoreboardProgressText = "Score final direct";
  }

  let scoreEntryHeadingText = "Saisir le score";
  let dealSubmitButtonText = `Valider la donne ${nextDealNumber}`;
  if (editingDealId !== null) {
    scoreEntryHeadingText = "Modifier la donne";
    dealSubmitButtonText = "Enregistrer la modification";
  }

  const dealSlots = [1, 2, 3, 4, 5];

  let myTeamNextFollowupMatch: UnifiedMatchRecord | null = null;
  let myTeamNextOpponentLabel = "";
  if (myTeamRecord !== null && myTimeline !== null) {
    if (
      myTimeline.currentMatch !== null &&
      myTimeline.currentMatch.id !== activeMatch.id &&
      (myTimeline.currentMatch.status === "in_progress" ||
        myTimeline.currentMatch.status === "pending")
    ) {
      myTeamNextFollowupMatch = myTimeline.currentMatch;
      if (myTimeline.opponent !== null) {
        myTeamNextOpponentLabel = formatPlayersPrimaryName(
          myTimeline.opponent.player1Name,
          myTimeline.opponent.player2Name,
        );
      }
    } else if (myTimeline.nextMatch !== null) {
      myTeamNextFollowupMatch = myTimeline.nextMatch;
      if (myTimeline.nextOpponent !== null) {
        myTeamNextOpponentLabel = formatPlayersPrimaryName(
          myTimeline.nextOpponent.player1Name,
          myTimeline.nextOpponent.player2Name,
        );
      }
    }
  }

  let followupBannerHeading = "Ton match actif assigné :";
  if (isMatchClosed) {
    followupBannerHeading = "Match terminé · Ton match suivant est prêt :";
  }

  return (
    <div className="container-mobile">
      <div className="table-stack">
        {/* Identification ultra-simple par PRÉNOM -> te met directement dans ton binôme et contre qui tu joues */}
        <section className="card-ruled" aria-label="Rejoindre par prénom">
          {myTeamRecord !== null && !showFirstNamePicker && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span className="eyebrow">
                    <UsersIcon size={12} />
                    <span>Ton binôme</span>
                  </span>
                  <div
                    className="font-display"
                    style={{
                      fontSize: "21px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      lineHeight: 1.05,
                    }}
                  >
                    {formatPlayersPrimaryName(
                      myTeamRecord.player1Name,
                      myTeamRecord.player2Name,
                    )}
                  </div>
                  {formatOptionalTeamNickname(
                    myTeamRecord.teamName,
                    myTeamRecord.player1Name,
                    myTeamRecord.player2Name,
                  ) !== null && (
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--accent-terracotta)",
                      }}
                    >
                      «{" "}
                      {formatOptionalTeamNickname(
                        myTeamRecord.teamName,
                        myTeamRecord.player1Name,
                        myTeamRecord.player2Name,
                      )}{" "}
                      »
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setShowFirstNamePicker(true)}
                >
                  Changer de prénom
                </button>
              </div>

              {myTeamNextFollowupMatch !== null && (
                <div
                  className="banner banner-pass"
                  style={{
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: "8px",
                  }}
                >
                  <div>
                    <strong>{followupBannerHeading}</strong>{" "}
                    Table {myTeamNextFollowupMatch.tableNumber ?? "–"} ·{" "}
                    {formatMatchContextBadge(myTeamNextFollowupMatch)}
                    {myTeamNextOpponentLabel.length > 0 &&
                      ` · contre ${myTeamNextOpponentLabel}`}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (myTeamNextFollowupMatch !== null) {
                        handleChangeSelectedMatch(myTeamNextFollowupMatch.id);
                      }
                    }}
                  >
                    <span>Aller à ce match</span>
                    <ArrowRightIcon size={15} />
                  </button>
                </div>
              )}

              {isMatchClosed &&
                myTeamNextFollowupMatch === null &&
                !summary.hasRealKnockoutBracket && (
                  <div className="banner banner-info" role="status">
                    <span>
                      <strong>Match terminé !</strong> Dès que les autres tables
                      finissent leurs 5 donnes, les phases finales se créent
                      automatiquement.
                    </span>
                  </div>
                )}

              {myTimeline !== null && myTimeline.isTournamentWinner && (
                <div className="banner banner-pass" role="status">
                  <TrophyIcon size={17} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Victoire en Finale !</strong> Vous remportez le
                    tournoi Coinch&apos;Eirb !
                  </span>
                </div>
              )}
            </div>
          )}

          {(myTeamRecord === null || showFirstNamePicker) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                }}
              >
                <label
                  htmlFor="ma-table-firstname-input"
                  className="field-label"
                  style={{ marginBottom: 0 }}
                >
                  Tape ton prénom pour ouvrir ta table :
                </label>
                {myTeamRecord !== null && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowFirstNamePicker(false)}
                  >
                    Fermer
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  id="ma-table-firstname-input"
                  type="text"
                  className="field-input"
                  style={{ minHeight: "42px", fontSize: "14px" }}
                  placeholder="Ex. Angèle, Chahe, Lucas..."
                  value={firstNameInput}
                  onChange={(e) => setFirstNameInput(e.target.value)}
                  autoComplete="given-name"
                />
                {myTeamRecord !== null && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      clearMyTeamIdFromStorage();
                      setMyTeamId(null);
                      setShowFirstNamePicker(false);
                    }}
                  >
                    Effacer
                  </button>
                )}
              </div>

              {firstNameSuggestions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {firstNameSuggestions.map((cand) => {
                    const candTimeline = resolveTeamMatchTimeline(
                      cand.team.id,
                      state.matches,
                      state.teams,
                    );
                    let oppInfo = "En attente de match";
                    if (candTimeline.currentMatch !== null) {
                      let oppLabel = "À déterminer";
                      if (candTimeline.opponent !== null) {
                        oppLabel = formatPlayersPrimaryName(
                          candTimeline.opponent.player1Name,
                          candTimeline.opponent.player2Name,
                        );
                      }
                      oppInfo = `Table ${candTimeline.currentMatch.tableNumber ?? "–"} · vs ${oppLabel} (${formatMatchContextBadge(candTimeline.currentMatch)})`;
                    }
                    return (
                      <button
                        key={cand.team.id}
                        type="button"
                        onClick={() => handleSelectMyTeam(cand.team.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-strong)",
                          backgroundColor: "var(--bg-surface-alt)",
                          color: "var(--ink-primary)",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="font-display"
                            style={{
                              fontSize: "17px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              lineHeight: 1.05,
                            }}
                          >
                            {cand.playersPrimary}
                          </div>
                          {cand.nickname !== null && (
                            <div
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "var(--accent-terracotta)",
                              }}
                            >
                              « {cand.nickname} »
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "11.5px",
                              color: "var(--ink-secondary)",
                            }}
                          >
                            {oppInfo}
                          </div>
                        </div>
                        <ArrowRightIcon
                          size={15}
                          style={{ color: "var(--accent-amber)", flexShrink: 0 }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sélecteur manuel de table (pour basculer ou arbitrer) */}
        <section className="card-alt" aria-label="Sélection manuelle de la table">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "6px",
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor="table-match-selector"
              className="field-label"
              style={{ marginBottom: 0 }}
            >
              Ou choisir une autre table :
            </label>
            <div style={{ display: "inline-flex", gap: "6px" }}>
              <Link
                href="/classement"
                className="badge badge-amber"
                title="Voir les poules et l'arbre final mis à jour"
              >
                <TrophyIcon size={11} />
                <span>Poules &amp; Arbre</span>
              </Link>
              <Link
                href="/live"
                className="badge badge-neutral"
                title="Ouvrir le grand écran vidéoprojecteur"
              >
                <ProjectorScreenIcon size={11} />
                <span>Écran /live</span>
              </Link>
            </div>
          </div>

          <select
            id="table-match-selector"
            className="field-input"
            style={{ minHeight: "42px", fontSize: "13.5px", fontWeight: 700 }}
            value={activeMatch.id}
            onChange={(e) => handleChangeSelectedMatch(e.target.value)}
          >
            {playableMatches.map((m) => {
              const tA = findUnifiedTeam(state.teams, m.teamAId);
              const tB = findUnifiedTeam(state.teams, m.teamBId);
              let nA = "Équipe A";
              if (tA !== null) {
                nA = formatPlayersPrimaryName(tA.player1Name, tA.player2Name);
              }
              let nB = "Équipe B";
              if (tB !== null) {
                nB = formatPlayersPrimaryName(tB.player1Name, tB.player2Name);
              }
              let stateTag = "En cours";
              if (m.status === "completed") {
                stateTag = `Terminé ${m.scoreTeamA}-${m.scoreTeamB}`;
              } else if (m.status === "forfeit") {
                stateTag = "Abandon";
              } else if (m.status === "pending") {
                stateTag = "À suivre";
              } else {
                stateTag = `${m.scoreTeamA}-${m.scoreTeamB}`;
              }

              return (
                <option key={m.id} value={m.id}>
                  Table {m.tableNumber ?? "–"} · {formatMatchContextBadge(m)} :{" "}
                  {nA} vs {nB} ({stateTag})
                </option>
              );
            })}
          </select>
        </section>

        {/* En-tête de table */}
        <div className="table-topbar">
          <div>
            <span className="eyebrow">
              Table {tableNumber} · {formatMatchContextBadge(activeMatch)}
            </span>
            <h1
              className="font-display"
              style={{
                margin: "2px 0 0",
                fontSize: "28px",
                fontWeight: 800,
                lineHeight: 1,
                textTransform: "uppercase",
              }}
            >
              Ma table
            </h1>
          </div>
          <span className={statusBadgeClass}>{statusBadgeText}</span>
        </div>

        {/* Bandeau Verrouillage Administrateur */}
        {isLockedByAdminSwitch && (
          <div className="banner banner-fail" role="alert">
            <LockIcon size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
            <div>
              <div>
                <strong>Saisie verrouillée par l&apos;administrateur.</strong>
              </div>
              <div style={{ fontSize: "12px", marginTop: "2px" }}>
                Les scores de cette table ne peuvent actuellement être modifiés
                que depuis le <Link href="/admin" style={{ textDecoration: "underline" }}>poste Admin (/admin)</Link>.
              </div>
            </div>
          </div>
        )}

        {/* Alerte arbitre active */}
        {refereeAlertMessage !== null && (
          <div className="banner banner-info" role="status">
            <BellAlertIcon
              size={18}
              style={{ flexShrink: 0, marginTop: "1px" }}
            />
            <span>{refereeAlertMessage}</span>
          </div>
        )}

        {/* Tableau de score principal */}
        <section className="scoreboard-card" aria-label="Score du match">
          <div className="scoreboard-meta">
            <span>{scoreboardLeftMeta}</span>
            <span className="tabular-nums">{scoreboardProgressText}</span>
          </div>

          <div className="scoreboard-columns">
            <div className="scoreboard-team" data-leading={teamALeading}>
              <h2 className="scoreboard-team-name">{teamAInfo.name}</h2>
              {teamAInfo.nickname !== null && (
                <p className="scoreboard-players">{teamAInfo.nickname}</p>
              )}
              <div className="scoreboard-points">{totalScoreA}</div>
            </div>

            <div className="scoreboard-team" data-leading={teamBLeading}>
              <h2 className="scoreboard-team-name">{teamBInfo.name}</h2>
              {teamBInfo.nickname !== null && (
                <p className="scoreboard-players">{teamBInfo.nickname}</p>
              )}
              <div className="scoreboard-points">{totalScoreB}</div>
            </div>
          </div>

          {activeMatch.phase === "pool" && (
            <div className="scoreboard-footer">
              <span style={{ fontWeight: 600 }}>Progression des donnes</span>
              <span
                className="deal-dots"
                aria-label={`${deals.length} donnes jouées`}
              >
                {dealSlots.map((slotNumber) => {
                  let filled = "false";
                  if (deals.length >= slotNumber) {
                    filled = "true";
                  }
                  return (
                    <span
                      key={slotNumber}
                      className="deal-dot"
                      data-filled={filled}
                    />
                  );
                })}
                {(matchProgress.requiresTiebreakerDeal ||
                  deals.length > state.tournament.dealsPerPoolMatch) && (
                  <span className="deal-dot" data-tiebreaker="true" />
                )}
              </span>
            </div>
          )}
        </section>

        {/* Bandeau 6e donne obligatoire si égalité */}
        {matchProgress.requiresTiebreakerDeal && (
          <div className="banner banner-info" role="status">
            <AlertTriangleIcon
              size={18}
              style={{ flexShrink: 0, marginTop: "1px" }}
            />
            <span>
              Égalité parfaite après {state.tournament.dealsPerPoolMatch}{" "}
              donnes : jouez une 6e donne décisive.
            </span>
          </div>
        )}

        {/* Formulaire de saisie (Par donne ou Score final direct) */}
        <section className="card-ruled" aria-labelledby="score-entry-heading">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <h2 id="score-entry-heading" className="section-title">
              {scoreEntryHeadingText}
            </h2>
            {editingDealId !== null && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={handleCancelEdit}
              >
                <XIcon size={14} />
                <span>Annuler</span>
              </button>
            )}
          </div>

          {editingDealId === null && (
            <div
              className="segmented"
              role="tablist"
              aria-label="Mode de saisie du score"
              style={{ marginBottom: "12px" }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={entryMode === "deal"}
                className="segmented-btn"
                data-active={dealModeActive}
                onClick={() => {
                  setEntryMode("deal");
                  setFormError(null);
                }}
              >
                Par donne
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={entryMode === "direct"}
                className="segmented-btn"
                data-active={directModeActive}
                onClick={() => {
                  setEntryMode("direct");
                  setFormError(null);
                }}
              >
                Score final direct
              </button>
            </div>
          )}

          {entryMode === "deal" && (
            <form onSubmit={handleDealSubmit} noValidate>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12.5px",
                  color: "var(--ink-secondary)",
                }}
              >
                Saisie directe du résultat de la donne : les points mettent
                automatiquement à jour votre poule et l&apos;arbre final.
              </p>

              <div className="score-inputs-grid">
                <div>
                  <label htmlFor="deal-score-a" className="field-label">
                    {teamAInfo.name}
                  </label>
                  <input
                    id="deal-score-a"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="field-input field-input-score"
                    placeholder="0"
                    value={inputA}
                    disabled={isInputDisabled}
                    onFocus={() => setQuickTargetSide("team_a")}
                    onChange={(event) => setInputA(event.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="deal-score-b" className="field-label">
                    {teamBInfo.name}
                  </label>
                  <input
                    id="deal-score-b"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="field-input field-input-score"
                    placeholder="0"
                    value={inputB}
                    disabled={isInputDisabled}
                    onFocus={() => setQuickTargetSide("team_b")}
                    onChange={(event) => setInputB(event.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    marginBottom: "6px",
                  }}
                >
                  <span className="field-label" style={{ marginBottom: 0 }}>
                    Paliers rapides pour :
                  </span>
                  <div
                    style={{ display: "inline-flex", gap: "4px" }}
                    role="group"
                    aria-label="Cible des paliers rapides"
                  >
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      data-active={quickSideAActive}
                      style={{
                        minHeight: "28px",
                        padding: "0 8px",
                        borderColor: quickSideABorder,
                        backgroundColor: quickSideABg,
                      }}
                      onClick={() => setQuickTargetSide("team_a")}
                    >
                      Éq. A
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      data-active={quickSideBActive}
                      style={{
                        minHeight: "28px",
                        padding: "0 8px",
                        borderColor: quickSideBBorder,
                        backgroundColor: quickSideBBg,
                      }}
                      onClick={() => setQuickTargetSide("team_b")}
                    >
                      Éq. B
                    </button>
                  </div>
                </div>

                <div className="quick-chips">
                  {QUICK_POINTS.map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      className="chip-btn"
                      disabled={isInputDisabled}
                      onClick={() => handleQuickChip(pts)}
                    >
                      +{pts}
                    </button>
                  ))}
                </div>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "12px",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-secondary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={parlantePenalty}
                  disabled={isInputDisabled}
                  onChange={(event) => setParlantePenalty(event.target.checked)}
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "#A64622",
                  }}
                />
                <span>Signaler une parlante sur cette donne (+160 pts)</span>
              </label>

              {formError !== null && (
                <div
                  className="banner banner-fail"
                  role="alert"
                  style={{ marginTop: "10px" }}
                >
                  <AlertTriangleIcon
                    size={16}
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                  <span>{formError}</span>
                </div>
              )}

              {formNotice !== null && (
                <div
                  className="banner banner-pass"
                  role="status"
                  style={{ marginTop: "10px" }}
                >
                  <CheckIcon
                    size={16}
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                  <span>{formNotice}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isInputDisabled}
                style={{ marginTop: "12px" }}
              >
                <CheckIcon size={18} />
                <span>{dealSubmitButtonText}</span>
              </button>
            </form>
          )}

          {entryMode === "direct" && (
            <form onSubmit={handleDirectScoreSubmit} noValidate>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "12.5px",
                  color: "var(--ink-secondary)",
                }}
              >
                En cas d&apos;oubli donne par donne, renseignez directement le
                score final du match (hors égalité).
              </p>

              <div className="score-inputs-grid">
                <div>
                  <label htmlFor="direct-score-a" className="field-label">
                    Total {teamAInfo.name}
                  </label>
                  <input
                    id="direct-score-a"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="field-input field-input-score"
                    placeholder="420"
                    value={directInputA}
                    disabled={isLockedByAdminSwitch || isForfeited}
                    onChange={(event) => setDirectInputA(event.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="direct-score-b" className="field-label">
                    Total {teamBInfo.name}
                  </label>
                  <input
                    id="direct-score-b"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="field-input field-input-score"
                    placeholder="310"
                    value={directInputB}
                    disabled={isLockedByAdminSwitch || isForfeited}
                    onChange={(event) => setDirectInputB(event.target.value)}
                  />
                </div>
              </div>

              {formError !== null && (
                <div
                  className="banner banner-fail"
                  role="alert"
                  style={{ marginTop: "10px" }}
                >
                  <AlertTriangleIcon
                    size={16}
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                  <span>{formError}</span>
                </div>
              )}

              {formNotice !== null && (
                <div
                  className="banner banner-pass"
                  role="status"
                  style={{ marginTop: "10px" }}
                >
                  <CheckIcon
                    size={16}
                    style={{ flexShrink: 0, marginTop: "1px" }}
                  />
                  <span>{formNotice}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isLockedByAdminSwitch || isForfeited}
                style={{ marginTop: "12px" }}
              >
                <CheckIcon size={18} />
                <span>Valider le score final direct</span>
              </button>
            </form>
          )}
        </section>

        {/* Panneau Annonces manuelles temps réel (/live) */}
        <AnnouncementPanel
          teamA={teamAInfo}
          teamB={teamBInfo}
          selectedSide={announcementSide}
          onSelectSide={setAnnouncementSide}
          pendingAnnouncement={pendingAnnouncement}
          lastLiveFeedMessage={lastLiveFeedMessage}
          disabled={isLockedByAdminSwitch || isForfeited}
          onTriggerAnnouncement={handleTriggerAnnouncement}
          onResolveAnnouncement={handleResolveAnnouncement}
          onCancelPending={() => setPendingAnnouncement(null)}
        />

        {/* Historique des donnes */}
        <ScoreHistoryList
          deals={deals}
          teamA={teamAInfo}
          teamB={teamBInfo}
          editingEnabled={!isLockedByAdminSwitch && !isForfeited}
          editingDealId={editingDealId}
          onStartEditDeal={handleStartEditDeal}
        />

        {/* Actions critiques : Arbitre & Abandon (double confirmation) */}
        <section className="card" aria-label="Arbitrage et abandon">
          <div className="critical-actions-grid">
            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={() => setRefereeModalOpen(true)}
            >
              <BellAlertIcon size={17} />
              <span>Appeler un arbitre</span>
            </button>

            <button
              type="button"
              className="btn btn-ghost-danger btn-full"
              disabled={isForfeited}
              onClick={() => setAbandonModalOpen(true)}
            >
              <FlagIcon size={17} />
              <span>Abandon</span>
            </button>
          </div>
        </section>

        <RefereeModal
          open={refereeModalOpen}
          tableNumber={tableNumber}
          onClose={() => setRefereeModalOpen(false)}
          onConfirm={handleConfirmReferee}
        />

        <AbandonModal
          open={abandonModalOpen}
          tableNumber={tableNumber}
          teamA={teamAInfo}
          teamB={teamBInfo}
          onClose={() => setAbandonModalOpen(false)}
          onConfirmForfeit={handleConfirmForfeit}
        />
      </div>
    </div>
  );
}
