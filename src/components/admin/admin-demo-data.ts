import {
  formatPoolLabel,
  generatePoolsAndSchedule,
  type CompletedPoolMatchInput,
  type GeneratedPoolMatch,
  type TournamentTeamInput,
} from "@/lib/tournament";
import type {
  AdminCockpitSnapshot,
  AdminLiveFeedEntry,
  AdminMatchRecord,
  AdminRefereeAlertItem,
} from "@/components/admin/admin-types";
import {
  buildInitialDemoTeams,
  buildInitialTournamentMeta,
} from "@/components/admin/admin-types";
import type { AnnouncementType, LivePopupPhase, MatchPhase, MatchStatus, TournamentStatus } from "@/types/database";

/**
 * Construit un instantane initial vierge (0 joueur fictif, 0 match fictif, 0 alerte fictive)
 * pret a etre alimente par les vrais joueurs de l'ENSEIRB.
 */
export function createInitialAdminCockpitSnapshot(): AdminCockpitSnapshot {
  const tournament = buildInitialTournamentMeta();
  const teams = buildInitialDemoTeams();

  return {
    tournament,
    teams,
    pools: [],
    matches: [],
    alerts: [],
    liveFeed: [],
    qualification: null,
    bracketNodes: [],
  };
}

export function formatTournamentStatusLabel(status: TournamentStatus): string {
  if (status === "draft") {
    return "Preparation";
  }
  if (status === "checkin") {
    return "Check-in avant 18h30";
  }
  if (status === "pools") {
    return "Phase de Poules (5 donnes)";
  }
  if (status === "round_of_16") {
    return "Huitiemes de finale · 500 pts";
  }
  if (status === "quarterfinals") {
    return "Quarts de finale · 600 pts";
  }
  if (status === "semifinals") {
    return "Demi-finales · 700 pts";
  }
  if (status === "final") {
    return "Grande Finale · 1000 pts";
  }
  return "Tournoi cloture";
}

export function formatMatchPhaseLabel(phase: MatchPhase): string {
  if (phase === "pool") {
    return "Poule · 5 donnes";
  }
  if (phase === "round_of_16") {
    return "8e de finale · 500 pts";
  }
  if (phase === "quarterfinals") {
    return "Quart · 600 pts";
  }
  if (phase === "semifinals") {
    return "Demie · 700 pts";
  }
  return "Finale · 1000 pts";
}

export function formatMatchStatusBadge(status: MatchStatus): {
  label: string;
  badgeClass: string;
} {
  if (status === "completed") {
    return { label: "Termine", badgeClass: "badge badge-pass" };
  }
  if (status === "in_progress") {
    return { label: "En cours", badgeClass: "badge badge-amber" };
  }
  if (status === "forfeit") {
    return { label: "Forfait", badgeClass: "badge badge-fail" };
  }
  if (status === "bye") {
    return { label: "Exempt", badgeClass: "badge badge-neutral" };
  }
  return { label: "A lancer", badgeClass: "badge badge-neutral" };
}

export function formatAnnouncementLabel(type: AnnouncementType): string {
  if (type === "capot") {
    return "Capot (250 pts)";
  }
  if (type === "generale") {
    return "Generale (500 pts)";
  }
  if (type === "coinche") {
    return "Coinche (x2)";
  }
  return "Surcoinche (x4)";
}

export function formatPopupPhaseLabel(phase: LivePopupPhase): string {
  if (phase === "announced") {
    return "Annonce en cours";
  }
  if (phase === "passed") {
    return "Contrat passe";
  }
  return "Contrat chute";
}

export function findTeamById(
  teams: TournamentTeamInput[],
  teamId: string | null,
): TournamentTeamInput | null {
  if (teamId === null) {
    return null;
  }
  for (const team of teams) {
    if (team.id === teamId) {
      return team;
    }
  }
  return null;
}

export function toCompletedPoolMatchInputs(
  matches: AdminMatchRecord[],
): CompletedPoolMatchInput[] {
  const result: CompletedPoolMatchInput[] = [];
  for (const match of matches) {
    if (
      match.phase === "pool" &&
      match.poolNumber !== null &&
      match.teamAId !== null &&
      match.teamBId !== null
    ) {
      result.push({
        poolNumber: match.poolNumber,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        scoreTeamA: match.scoreTeamA,
        scoreTeamB: match.scoreTeamB,
        status: match.status,
        winnerTeamId: match.winnerTeamId,
        forfeitTeamId: match.forfeitTeamId,
      });
    }
  }
  return result;
}

/**
 * Inspecte cote navigateur les 12 premiers octets d'un fichier image avant upload
 * pour verifier qu'il s'agit bien d'un binaire PNG, JPEG ou WebP reel.
 */
export async function inspectClientImageMagicBytes(
  file: File,
): Promise<{ valid: boolean; detectedMime: string; reason: string | null }> {
  const MAX_CLIENT_BYTES = 4 * 1024 * 1024;
  if (file.size === 0) {
    return {
      valid: false,
      detectedMime: "inconnu",
      reason: "Le fichier selectionne est vide.",
    };
  }

  if (file.size > MAX_CLIENT_BYTES) {
    return {
      valid: false,
      detectedMime: file.type,
      reason: "L'affiche depasse la limite maximale autorisee de 4 Mo.",
    };
  }

  const headerSlice = file.slice(0, 12);
  const buffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.byteLength < 12) {
    return {
      valid: false,
      detectedMime: "inconnu",
      reason: "En-tete binaire du fichier image incomplet.",
    };
  }

  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (isPng) {
    return { valid: true, detectedMime: "image/png", reason: null };
  }

  const isJpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (isJpeg) {
    return { valid: true, detectedMime: "image/jpeg", reason: null };
  }

  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (isWebp) {
    return { valid: true, detectedMime: "image/webp", reason: null };
  }

  return {
    valid: false,
    detectedMime: "non supporte",
    reason:
      "Signatures binaires non reconnues. Seuls les fichiers JPEG, PNG et WebP sont acceptes.",
  };
}
