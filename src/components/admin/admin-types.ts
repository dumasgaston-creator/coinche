import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import type {
  GeneratedBracketNode,
  GeneratedPool,
  QualificationOutcome,
  TournamentTeamInput,
} from "@/lib/tournament";
import type {
  AnnouncementType,
  LivePopupPhase,
  MatchPhase,
  MatchStatus,
  RefereeAlertStatus,
  RefereeAlertType,
  TournamentStatus,
} from "@/types/database";

export interface AdminMatchRecord {
  id: string;
  phase: MatchPhase;
  poolNumber: number | null;
  poolLabel: string | null;
  roundNumber: number;
  bracketSlot: number | null;
  tableNumber: number | null;
  teamAId: string | null;
  teamBId: string | null;
  scoreTeamA: number;
  scoreTeamB: number;
  targetScore: number | null;
  maxDeals: number | null;
  dealsPlayed: number;
  isDirectFinalScore: boolean;
  status: MatchStatus;
  winnerTeamId: string | null;
  forfeitTeamId: string | null;
  lockedByAdmin: boolean;
  updatedByRole: "team" | "admin" | null;
  updatedAtLabel: string;
}

export interface AdminRefereeAlertItem {
  id: string;
  matchId: string;
  tableNumber: number;
  requestingTeamId: string;
  requestingTeamName: string;
  alertType: RefereeAlertType;
  message: string;
  status: RefereeAlertStatus;
  createdAtLabel: string;
  resolvedAtLabel: string | null;
}

export interface AdminLiveFeedEntry {
  id: string;
  tableNumber: number;
  teamName: string;
  announcementType: AnnouncementType;
  phase: LivePopupPhase;
  pointsAwarded: number | null;
  createdAtLabel: string;
}

export interface AdminTournamentMeta {
  id: string;
  title: string;
  eventDate: string;
  startsAtLabel: string;
  schoolYear: string;
  status: TournamentStatus;
  registrationsLocked: boolean;
  playerScoreEditingEnabled: boolean;
  roundOf16Threshold: number;
  dealsPerPoolMatch: number;
  targetScoreR16: number;
  targetScoreQf: number;
  targetScoreSf: number;
  targetScoreFinal: number;
  posterUrl: string;
  posterMimeLabel: string;
  posterSizeLabel: string;
}

export interface AdminCockpitSnapshot {
  tournament: AdminTournamentMeta;
  teams: TournamentTeamInput[];
  pools: GeneratedPool[];
  matches: AdminMatchRecord[];
  alerts: AdminRefereeAlertItem[];
  liveFeed: AdminLiveFeedEntry[];
  qualification: QualificationOutcome | null;
  bracketNodes: GeneratedBracketNode[];
}

export const INITIAL_DEMO_CSV_SAMPLE = [
  "Joueur 1 / Joueur 2\tSURNOM",
  "Angèle / Kamila\tTeam bouder",
  "Gaston / Jules\t",
  "Arthur / Mathis\tShowshow lapin",
  "Gabriel / Clovis\tGabouzz et Cloporte",
  "Titou / Joé\tTeam Joé",
  "Chahe / Antonin\t",
  "Puff / Baptiste\t",
  "Martin / Ulysse\tPère et fils",
  "Marie / Kiki\tLes maîtres",
  "Maxence / Thomas\t",
  "Anya / Pierre\t",
  "Elie / Naël\t",
  "Nolan / Remi\t",
  "Kitchi / Tom\t",
  "Rodri / Neto\t",
  "Marion / Lilian\t",
  "Nico / br7\t",
  "Lenny / Dona\tPlus besoin de les présenter",
  "Philo / Maxime\t",
  "Bely / Thib\t",
].join("\n");

const INITIAL_TEAM_SEED: Array<{
  teamName: string;
  player1Name: string;
  player2Name: string;
}> = [
  { teamName: "Les Valets d'Or", player1Name: "Camille Roux", player2Name: "Lucas Girard" },
  { teamName: "Atout Pique 33", player1Name: "Maxime Lefèvre", player2Name: "Sarah Benali" },
  { teamName: "Dix de Der", player1Name: "Antoine Mercier", player2Name: "Chloé Faure" },
  { teamName: "Capot Royal", player1Name: "Hugo Blanc", player2Name: "Léa Chevalier" },
  { teamName: "Sans Atout Matmeca", player1Name: "Thomas Garnier", player2Name: "Inès Morel" },
  { teamName: "Générale 500", player1Name: "Nicolas Robin", player2Name: "Manon Guérin" },
  { teamName: "Belote & Rebelote", player1Name: "Alexandre Boyer", player2Name: "Juliette Masson" },
  { teamName: "Surcoinche Eirb", player1Name: "Romain Fournier", player2Name: "Clara Gautier" },
  { teamName: "Les Quatre As", player1Name: "Mathieu Perrin", player2Name: "Eva Lemoine" },
  { teamName: "Cœur Vaillant", player1Name: "Pauline Colin", player2Name: "Julien Vidal" },
  { teamName: "Trèfle Mécanique", player1Name: "Bastien Caron", player2Name: "Alice Picard" },
  { teamName: "Carreau Express", player1Name: "Florian Renard", player2Name: "Anaïs Arnaud" },
  { teamName: "Pli Suprême", player1Name: "Quentin Brunet", player2Name: "Maëlys Marty" },
  { teamName: "160 Chuté", player1Name: "Valentin Aubert", player2Name: "Noémie Rolland" },
  { teamName: "Les Rois du Tapis", player1Name: "Guillaume Leclerc", player2Name: "Céline Barbier" },
  { teamName: "Pique & Cœur", player1Name: "Adrien Schmitt", player2Name: "Marine Leroux" },
  { teamName: "Coinche Nocturne", player1Name: "Damien Bourgeois", player2Name: "Laura Dupuy" },
  { teamName: "Foyer Enseirb", player1Name: "Benoît Lemaire", player2Name: "Élise Noel" },
  { teamName: "Les As du 9", player1Name: "Rémi Fontaine", player2Name: "Margaux Moulin" },
  { teamName: "Impasse Maitre", player1Name: "Théo Marchand", player2Name: "Lucie Prévost" },
];

export function buildInitialDemoTeams(): TournamentTeamInput[] {
  return INITIAL_TEAM_SEED.map((item, idx) => {
    const cleanName = sanitizePlainName(item.teamName);
    return {
      id: `team-${String(idx + 1).padStart(2, "0")}`,
      teamName: cleanName,
      normalizedName: normalizeComparisonKey(cleanName),
      player1Name: sanitizePlainName(item.player1Name),
      player2Name: sanitizePlainName(item.player2Name),
      checkedIn: true,
      isForfeit: false,
      seedOrder: idx + 1,
    };
  });
}

export function buildInitialTournamentMeta(): AdminTournamentMeta {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Tournoi Coinch'Eirb · Soirée Foyer ENSEIRB-MATMECA",
    eventDate: "2026-11-26",
    startsAtLabel: "18h30",
    schoolYear: "2026-2027",
    status: "pools",
    registrationsLocked: true,
    playerScoreEditingEnabled: true,
    roundOf16Threshold: 12,
    dealsPerPoolMatch: 5,
    targetScoreR16: 500,
    targetScoreQf: 600,
    targetScoreSf: 700,
    targetScoreFinal: 1000,
    posterUrl: "/assets/affiche-soiree.jpg",
    posterMimeLabel: "image/jpeg",
    posterSizeLabel: "Affiche officielle",
  };
}
