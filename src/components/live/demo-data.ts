import type { AnnouncementType, LivePopupPhase } from "@/types/database";
import { formatPoolLabel } from "@/lib/tournament/pool-generator";
import { computePoolStandings, resolvePoolQualifications } from "@/lib/tournament/qualification";
import { generateKnockoutBracket } from "@/lib/tournament/bracket";
import type {
  CompletedPoolMatchInput,
  GeneratedPool,
  TournamentTeamInput,
} from "@/lib/tournament/types";
import type {
  LiveAnnouncementEvent,
  LiveBracketMatchView,
  LiveSlideDefinition,
  LiveTableMatchItem,
  LiveTournamentSnapshot,
} from "@/components/live/types";

export const LIVE_SLIDES: readonly LiveSlideDefinition[] = [
  {
    id: "pools",
    index: 0,
    shortLabel: "Poules",
    title: "Classement des poules",
    subtitle: "20 équipes · 5 poules de 4 · Top 3 + meilleur 4e qualifiés",
  },
  {
    id: "best_fourths",
    index: 1,
    shortLabel: "Meilleurs 4es",
    title: "Course aux meilleurs 4es",
    subtitle: "1 billet qualificatif · Départage par points marqués puis force de la poule",
  },
  {
    id: "tables",
    index: 2,
    shortLabel: "Tables en cours",
    title: "Matchs en cours aux tables",
    subtitle: "Tour 3 des poules · 5 donnes + 6e donne décisive si égalité",
  },
  {
    id: "bracket",
    index: 3,
    shortLabel: "Arbre final",
    title: "Tableau phase finale",
    subtitle: "Huitièmes 500 pts · Quarts 600 pts · Demies 700 pts · Finale 1000 pts",
  },
  {
    id: "poster",
    index: 4,
    shortLabel: "Soirée",
    title: "Affiche & infos soirée",
    subtitle: "Coinch'Eirb ENSEIRB-MATMECA · Premier tour à 18h30",
  },
];

interface DemoTeamSeed {
  id: string;
  poolNumber: number;
  positionInPool: number;
  teamName: string;
  player1Name: string;
  player2Name: string;
  seedOrder: number;
}

const DEMO_TEAMS: readonly DemoTeamSeed[] = [
  // Poule A (poolTotalPoints = 2540)
  { id: "team-a1", poolNumber: 1, positionInPool: 1, teamName: "Les Rois du Neuf", player1Name: "Arthur", player2Name: "Manon", seedOrder: 1 },
  { id: "team-a2", poolNumber: 1, positionInPool: 2, teamName: "Valets d'Eirb", player1Name: "Lucas", player2Name: "Camille", seedOrder: 10 },
  { id: "team-a3", poolNumber: 1, positionInPool: 3, teamName: "Sans Atout Club", player1Name: "Hugo", player2Name: "Léa", seedOrder: 11 },
  { id: "team-a4", poolNumber: 1, positionInPool: 4, teamName: "Carreau Express", player1Name: "Nolan", player2Name: "Zoé", seedOrder: 20 },

  // Poule B (poolTotalPoints = 2630)
  { id: "team-b1", poolNumber: 2, positionInPool: 1, teamName: "Belote & Matmeca", player1Name: "Nathan", player2Name: "Chloé", seedOrder: 2 },
  { id: "team-b2", poolNumber: 2, positionInPool: 2, teamName: "Tout Atout 33", player1Name: "Bastien", player2Name: "Emma", seedOrder: 9 },
  { id: "team-b3", poolNumber: 2, positionInPool: 3, teamName: "Atout Cœur", player1Name: "Théo", player2Name: "Inès", seedOrder: 12 },
  { id: "team-b4", poolNumber: 2, positionInPool: 4, teamName: "Dix de Der", player1Name: "Sacha", player2Name: "Jade", seedOrder: 19 },

  // Poule C (poule la plus forte : poolTotalPoints = 2810 -> departage le meilleur 4e)
  { id: "team-c1", poolNumber: 3, positionInPool: 1, teamName: "Surcoinche Élite", player1Name: "Gabriel", player2Name: "Clara", seedOrder: 3 },
  { id: "team-c2", poolNumber: 3, positionInPool: 2, teamName: "Capot Bordelais", player1Name: "Jules", player2Name: "Alice", seedOrder: 8 },
  { id: "team-c3", poolNumber: 3, positionInPool: 3, teamName: "Les Enfants du 14", player1Name: "Enzo", player2Name: "Romane", seedOrder: 13 },
  { id: "team-c4", poolNumber: 3, positionInPool: 4, teamName: "Dame de Pique", player1Name: "Paul", player2Name: "Louise", seedOrder: 18 },

  // Poule D (poolTotalPoints = 2470)
  { id: "team-d1", poolNumber: 4, positionInPool: 1, teamName: "Générale Sec", player1Name: "Maxime", player2Name: "Sarah", seedOrder: 4 },
  { id: "team-d2", poolNumber: 4, positionInPool: 2, teamName: "Plis d'Or", player1Name: "Antoine", player2Name: "Lucie", seedOrder: 7 },
  { id: "team-d3", poolNumber: 4, positionInPool: 3, teamName: "As de Trèfle", player1Name: "Clément", player2Name: "Eva", seedOrder: 14 },
  { id: "team-d4", poolNumber: 4, positionInPool: 4, teamName: "Petit Vingt", player1Name: "Tom", player2Name: "Mila", seedOrder: 17 },

  // Poule E (poolTotalPoints = 2590)
  { id: "team-e1", poolNumber: 5, positionInPool: 1, teamName: "Bzz Coinche", player1Name: "Raphaël", player2Name: "Agathe", seedOrder: 5 },
  { id: "team-e2", poolNumber: 5, positionInPool: 2, teamName: "Tapis Vert Eirb", player1Name: "Louis", player2Name: "Nina", seedOrder: 6 },
  { id: "team-e3", poolNumber: 5, positionInPool: 3, teamName: "Reprise 160", player1Name: "Valentin", player2Name: "Maëlle", seedOrder: 15 },
  { id: "team-e4", poolNumber: 5, positionInPool: 4, teamName: "Belote Rétro", player1Name: "Marius", player2Name: "Juliette", seedOrder: 16 },
];

// Matchs termines (Tours 1 et 2 complets) permettant de calculer exactement les classements
// et de montrer l'egalite parfaite entre Dame de Pique (Poule C, 1V, 620 pts, poule a 3090)
// et Carreau Express (Poule A, 1V, 620 pts, poule a 2660).
const DEMO_COMPLETED_POOL_MATCHES: readonly CompletedPoolMatchInput[] = [
  // Poule A (total = 2660 pts : a1=730, a3=660, a2=650, a4=620, tous a 1V)
  { poolNumber: 1, teamAId: "team-a1", teamBId: "team-a4", scoreTeamA: 420, scoreTeamB: 250, status: "completed", winnerTeamId: "team-a1", forfeitTeamId: null },
  { poolNumber: 1, teamAId: "team-a2", teamBId: "team-a3", scoreTeamA: 390, scoreTeamB: 300, status: "completed", winnerTeamId: "team-a2", forfeitTeamId: null },
  { poolNumber: 1, teamAId: "team-a1", teamBId: "team-a3", scoreTeamA: 310, scoreTeamB: 360, status: "completed", winnerTeamId: "team-a3", forfeitTeamId: null },
  { poolNumber: 1, teamAId: "team-a2", teamBId: "team-a4", scoreTeamA: 260, scoreTeamB: 370, status: "completed", winnerTeamId: "team-a4", forfeitTeamId: null },

  // Poule B (b4 = 0V, 520 pts)
  { poolNumber: 2, teamAId: "team-b1", teamBId: "team-b4", scoreTeamA: 490, scoreTeamB: 260, status: "completed", winnerTeamId: "team-b1", forfeitTeamId: null },
  { poolNumber: 2, teamAId: "team-b2", teamBId: "team-b3", scoreTeamA: 420, scoreTeamB: 310, status: "completed", winnerTeamId: "team-b2", forfeitTeamId: null },
  { poolNumber: 2, teamAId: "team-b1", teamBId: "team-b3", scoreTeamA: 470, scoreTeamB: 330, status: "completed", winnerTeamId: "team-b1", forfeitTeamId: null },
  { poolNumber: 2, teamAId: "team-b2", teamBId: "team-b4", scoreTeamA: 380, scoreTeamB: 260, status: "completed", winnerTeamId: "team-b2", forfeitTeamId: null },

  // Poule C (poule la plus forte, total = 3090 pts : c1=930, c3=780, c2=760, c4=620, tous a 1V)
  { poolNumber: 3, teamAId: "team-c1", teamBId: "team-c4", scoreTeamA: 520, scoreTeamB: 300, status: "completed", winnerTeamId: "team-c1", forfeitTeamId: null },
  { poolNumber: 3, teamAId: "team-c2", teamBId: "team-c3", scoreTeamA: 480, scoreTeamB: 340, status: "completed", winnerTeamId: "team-c2", forfeitTeamId: null },
  { poolNumber: 3, teamAId: "team-c1", teamBId: "team-c3", scoreTeamA: 410, scoreTeamB: 440, status: "completed", winnerTeamId: "team-c3", forfeitTeamId: null },
  { poolNumber: 3, teamAId: "team-c2", teamBId: "team-c4", scoreTeamA: 280, scoreTeamB: 320, status: "completed", winnerTeamId: "team-c4", forfeitTeamId: null },

  // Poule D (d4 = 0V, 510 pts)
  { poolNumber: 4, teamAId: "team-d1", teamBId: "team-d4", scoreTeamA: 470, scoreTeamB: 260, status: "completed", winnerTeamId: "team-d1", forfeitTeamId: null },
  { poolNumber: 4, teamAId: "team-d2", teamBId: "team-d3", scoreTeamA: 430, scoreTeamB: 320, status: "completed", winnerTeamId: "team-d2", forfeitTeamId: null },
  { poolNumber: 4, teamAId: "team-d1", teamBId: "team-d3", scoreTeamA: 440, scoreTeamB: 290, status: "completed", winnerTeamId: "team-d1", forfeitTeamId: null },
  { poolNumber: 4, teamAId: "team-d2", teamBId: "team-d4", scoreTeamA: 390, scoreTeamB: 250, status: "completed", winnerTeamId: "team-d2", forfeitTeamId: null },

  // Poule E (e4 = 1V, 580 pts)
  { poolNumber: 5, teamAId: "team-e1", teamBId: "team-e4", scoreTeamA: 490, scoreTeamB: 270, status: "completed", winnerTeamId: "team-e1", forfeitTeamId: null },
  { poolNumber: 5, teamAId: "team-e2", teamBId: "team-e3", scoreTeamA: 410, scoreTeamB: 330, status: "completed", winnerTeamId: "team-e2", forfeitTeamId: null },
  { poolNumber: 5, teamAId: "team-e1", teamBId: "team-e3", scoreTeamA: 300, scoreTeamB: 340, status: "completed", winnerTeamId: "team-e3", forfeitTeamId: null },
  { poolNumber: 5, teamAId: "team-e2", teamBId: "team-e4", scoreTeamA: 260, scoreTeamB: 310, status: "completed", winnerTeamId: "team-e4", forfeitTeamId: null },
];

function formatPlayersPair(team: DemoTeamSeed): string {
  return `${team.player1Name} & ${team.player2Name}`;
}

export function buildDemoTournamentSnapshot(): LiveTournamentSnapshot {
  const teamById = new Map<string, DemoTeamSeed>();
  const tournamentTeams: TournamentTeamInput[] = [];

  for (const seed of DEMO_TEAMS) {
    teamById.set(seed.id, seed);
    tournamentTeams.push({
      id: seed.id,
      teamName: seed.teamName,
      normalizedName: seed.teamName.toLowerCase(),
      player1Name: seed.player1Name,
      player2Name: seed.player2Name,
      checkedIn: true,
      isForfeit: false,
      seedOrder: seed.seedOrder,
    });
  }

  const pools: GeneratedPool[] = [];
  for (let p = 1; p <= 5; p += 1) {
    const members = DEMO_TEAMS.filter((t) => t.poolNumber === p);
    pools.push({
      poolNumber: p,
      poolLabel: formatPoolLabel(p),
      size: members.length,
      assignedTableStart: (p - 1) * 2 + 1,
      assignedTableCount: 2,
      teams: members.map((m) => ({
        teamId: m.id,
        teamName: m.teamName,
        positionInPool: m.positionInPool,
      })),
    });
  }

  const poolStandings = computePoolStandings(
    pools,
    tournamentTeams,
    [...DEMO_COMPLETED_POOL_MATCHES],
  );
  const qualification = resolvePoolQualifications(poolStandings, 12);
  const bracketNodes = generateKnockoutBracket({
    format: qualification.format,
    qualifiedTeams: qualification.qualifiedTeams,
    startingTableNumber: 1,
  });

  const nameLookup = new Map<string, string>();
  for (const team of DEMO_TEAMS) {
    nameLookup.set(team.id, team.teamName);
  }

  const bracketMatches: LiveBracketMatchView[] = bracketNodes.map((node) => {
    let teamAName = "À déterminer";
    if (node.teamAId !== null) {
      teamAName = nameLookup.get(node.teamAId) ?? "Équipe";
    } else if (node.seedA !== null) {
      teamAName = `Qualifié #${node.seedA}`;
    }

    let teamBName = "À déterminer";
    if (node.teamBId !== null) {
      teamBName = nameLookup.get(node.teamBId) ?? "Équipe";
    } else if (node.seedB !== null) {
      teamBName = `Qualifié #${node.seedB}`;
    }

    return {
      node,
      teamAName,
      teamBName,
      scoreTeamA: 0,
      scoreTeamB: 0,
      status: node.status,
      winnerTeamId: node.winnerTeamId,
    };
  });

  const activePairs: Array<{
    tableNumber: number;
    poolNumber: number;
    teamAId: string;
    teamBId: string;
    scoreA: number;
    scoreB: number;
    dealsPlayed: number;
    announcement: string | null;
    tone: "amber" | "pass" | "fail" | "neutral";
  }> = [
    { tableNumber: 1, poolNumber: 1, teamAId: "team-a1", teamBId: "team-a2", scoreA: 340, scoreB: 210, dealsPlayed: 4, announcement: "Capot +250 · Les Rois du Neuf", tone: "pass" },
    { tableNumber: 2, poolNumber: 1, teamAId: "team-a3", teamBId: "team-a4", scoreA: 260, scoreB: 280, dealsPlayed: 4, announcement: "Coinche passée x2", tone: "pass" },
    { tableNumber: 3, poolNumber: 2, teamAId: "team-b1", teamBId: "team-b2", scoreA: 350, scoreB: 350, dealsPlayed: 5, announcement: "Égalité · 6e donne décisive", tone: "amber" },
    { tableNumber: 4, poolNumber: 2, teamAId: "team-b3", teamBId: "team-b4", scoreA: 310, scoreB: 190, dealsPlayed: 3, announcement: "Parlante +160", tone: "fail" },
    { tableNumber: 5, poolNumber: 3, teamAId: "team-c1", teamBId: "team-c2", scoreA: 420, scoreB: 360, dealsPlayed: 4, announcement: "Générale annoncée", tone: "amber" },
    { tableNumber: 6, poolNumber: 3, teamAId: "team-c3", teamBId: "team-c4", scoreA: 240, scoreB: 330, dealsPlayed: 4, announcement: "Coinche chutée 320 pts", tone: "fail" },
    { tableNumber: 7, poolNumber: 4, teamAId: "team-d1", teamBId: "team-d2", scoreA: 390, scoreB: 290, dealsPlayed: 5, announcement: "Match terminé (5 donnes)", tone: "neutral" },
    { tableNumber: 8, poolNumber: 4, teamAId: "team-d3", teamBId: "team-d4", scoreA: 220, scoreB: 250, dealsPlayed: 3, announcement: null, tone: "neutral" },
    { tableNumber: 9, poolNumber: 5, teamAId: "team-e1", teamBId: "team-e2", scoreA: 310, scoreB: 300, dealsPlayed: 4, announcement: "Surcoinche x4 en cours", tone: "amber" },
    { tableNumber: 10, poolNumber: 5, teamAId: "team-e3", teamBId: "team-e4", scoreA: 180, scoreB: 240, dealsPlayed: 3, announcement: null, tone: "neutral" },
  ];

  const activeMatches: LiveTableMatchItem[] = [];
  for (const item of activePairs) {
    const teamA = teamById.get(item.teamAId);
    const teamB = teamById.get(item.teamBId);
    if (teamA === undefined || teamB === undefined) {
      continue;
    }

    let status: "in_progress" | "completed" = "in_progress";
    if (item.dealsPlayed >= 5 && item.scoreA !== item.scoreB) {
      status = "completed";
    }

    activeMatches.push({
      id: `demo-match-t${item.tableNumber}`,
      tableNumber: item.tableNumber,
      phase: "pool",
      phaseLabel: `${formatPoolLabel(item.poolNumber)} · Tour 3`,
      roundNumber: 3,
      teamAId: teamA.id,
      teamAName: teamA.teamName,
      teamAPlayers: formatPlayersPair(teamA),
      teamBId: teamB.id,
      teamBName: teamB.teamName,
      teamBPlayers: formatPlayersPair(teamB),
      scoreTeamA: item.scoreA,
      scoreTeamB: item.scoreB,
      dealsPlayed: item.dealsPlayed,
      maxDeals: 5,
      targetScore: null,
      status,
      recentAnnouncement: item.announcement,
      recentAnnouncementTone: item.tone,
    });
  }

  return {
    tournamentId: "demo-coincheirb-2026",
    tournamentTitle: "Tournoi Coinch'Eirb · ENSEIRB-MATMECA",
    tournamentStatus: "pools",
    phaseLabel: "Phase de poules · Tour 3 / 3",
    startTimeLabel: "1er tour à 18h30",
    posterUrl: "/assets/affiche-soiree.jpg",
    dealsPerPoolMatch: 5,
    roundOf16Threshold: 12,
    poolStandings,
    wildcardCandidates: qualification.wildcardCandidatesRanked,
    wildcardSlotsAvailable: 1,
    activeMatches,
    bracketMatches,
  };
}

interface SimulationScenario {
  tableNumber: number;
  teamName: string;
  opponentName: string;
  announcementType: AnnouncementType;
  outcomePhase: Exclude<LivePopupPhase, "announced">;
  pointsAwarded: number;
  contractNote: string;
}

const SIMULATION_SCENARIOS: readonly SimulationScenario[] = [
  {
    tableNumber: 5,
    teamName: "Surcoinche Élite",
    opponentName: "Capot Bordelais",
    announcementType: "generale",
    outcomePhase: "passed",
    pointsAwarded: 500,
    contractNote: "Générale annoncée à cœur",
  },
  {
    tableNumber: 2,
    teamName: "Carreau Express",
    opponentName: "Sans Atout Club",
    announcementType: "capot",
    outcomePhase: "passed",
    pointsAwarded: 250,
    contractNote: "Capot Tout Atout",
  },
  {
    tableNumber: 9,
    teamName: "Bzz Coinche",
    opponentName: "Tapis Vert Eirb",
    announcementType: "surcoinche",
    outcomePhase: "failed",
    pointsAwarded: 640,
    contractNote: "Contrat 130 surcoinché",
  },
  {
    tableNumber: 6,
    teamName: "Dame de Pique",
    opponentName: "Les Enfants du 14",
    announcementType: "coinche",
    outcomePhase: "passed",
    pointsAwarded: 240,
    contractNote: "Contrat 120 coinché",
  },
];

export function buildSimulatedAnnouncementEvents(
  scenarioIndex: number,
  seedCounter: number,
): {
  announcedEvent: LiveAnnouncementEvent;
  verdictEvent: LiveAnnouncementEvent;
} {
  const safeIndex = Math.abs(scenarioIndex) % SIMULATION_SCENARIOS.length;
  const scenario = SIMULATION_SCENARIOS[safeIndex] ?? SIMULATION_SCENARIOS[0];
  if (scenario === undefined) {
    throw new Error("Scenario de simulation introuvable.");
  }

  const baseId = `sim-${Date.now()}-${seedCounter}`;
  const nowIso = new Date().toISOString();

  const announcedEvent: LiveAnnouncementEvent = {
    queueKey: `${baseId}:announced`,
    id: baseId,
    tableNumber: scenario.tableNumber,
    teamName: scenario.teamName,
    opponentName: scenario.opponentName,
    announcementType: scenario.announcementType,
    phase: "announced",
    pointsAwarded: null,
    contractNote: scenario.contractNote,
    createdAt: nowIso,
  };

  const verdictEvent: LiveAnnouncementEvent = {
    queueKey: `${baseId}:${scenario.outcomePhase}`,
    id: baseId,
    tableNumber: scenario.tableNumber,
    teamName: scenario.teamName,
    opponentName: scenario.opponentName,
    announcementType: scenario.announcementType,
    phase: scenario.outcomePhase,
    pointsAwarded: scenario.pointsAwarded,
    contractNote: scenario.contractNote,
    createdAt: nowIso,
  };

  return { announcedEvent, verdictEvent };
}
