import { describe, expect, it } from "vitest";
import {
  calculateCoincheDealScore,
  computeEffectiveContractThreshold,
  computeOptimalPoolSizes,
  computePoolStandings,
  determineKnockoutFormat,
  evaluateMatchProgress,
  generateKnockoutBracket,
  generatePoolsAndSchedule,
  parseRegistrationsFromText,
  resolveGoogleSheetsCsvUrl,
  resolvePoolQualifications,
  type CompletedPoolMatchInput,
  type TournamentTeamInput,
} from "@/lib/tournament";
import {
  autoAdvanceTournamentStage,
  createDefaultUnifiedTournamentState,
} from "@/lib/tournament/live-store";
import { searchTeamsByFirstName } from "@/lib/tournament/player-lookup";

function buildMockTeams(count: number): TournamentTeamInput[] {
  const list: TournamentTeamInput[] = [];
  for (let i = 1; i <= count; i += 1) {
    const padded = String(i).padStart(2, "0");
    list.push({
      id: `00000000-0000-0000-0000-0000000000${padded}`,
      teamName: `Equipe ${padded}`,
      normalizedName: `equipe ${padded}`,
      player1Name: `Joueur A${padded}`,
      player2Name: `Joueur B${padded}`,
      checkedIn: true,
      isForfeit: false,
      seedOrder: i,
    });
  }
  return list;
}

describe("Import algorithmique Google Sheets CSV et copier-coller", () => {
  it("extrait les colonnes depuis un export CSV Google Forms avec Horodateur", () => {
    const csv = [
      "Horodateur,Nom d'équipe,Joueur 1,Joueur 2",
      '25/11/2026 14:12:00,"Les Abeilles d\'Or",Alice Martin,Chloé Bernard',
      "25/11/2026 14:15:00,Capot Royal,Lucas Petit,Hugo Moreau",
    ].join("\r\n");

    const parsed = parseRegistrationsFromText(csv);
    expect(parsed.delimiter).toBe(",");
    expect(parsed.hasHeaderRow).toBe(true);
    expect(parsed.validRows).toHaveLength(2);
    expect(parsed.duplicates).toHaveLength(0);
    expect(parsed.rowErrors).toHaveLength(0);
    expect(parsed.validRows[0]?.teamName).toBe("Les Abeilles d'Or");
    expect(parsed.validRows[0]?.player1Name).toBe("Alice Martin");
    expect(parsed.validRows[0]?.player2Name).toBe("Chloé Bernard");
  });

  it("accepte un copier-coller direct de 3 colonnes tabulees sans en-tete", () => {
    const tsv = [
      "Atout Coeur\tMaxime Durand\tSarah Leroy",
      "Sans Atout\tThomas Roux\tInes Blanc",
    ].join("\n");

    const parsed = parseRegistrationsFromText(tsv);
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.hasHeaderRow).toBe(false);
    expect(parsed.validRows).toHaveLength(2);
    expect(parsed.duplicates).toHaveLength(0);
  });

  it("detecte les doublons d'equipes et de joueurs sans sensibilite aux accents ni a la casse", () => {
    const csv = [
      "Nom d'equipe;Joueur 1;Joueur 2",
      "Les Éclairs;Chloé Martin;Paul Dupuis",
      "les eclairs;Nina Garnier;Leo Faure",
      "Roi de Pique;Chloe  Martin; Yanis Chevalier",
      "Double Solo;Marc Weber;marc weber",
    ].join("\n");

    const parsed = parseRegistrationsFromText(csv);
    expect(parsed.validRows).toHaveLength(4);
    expect(parsed.duplicates).toHaveLength(3);

    const types = parsed.duplicates.map((d) => d.type).sort();
    expect(types).toEqual([
      "duplicate_player_name",
      "duplicate_team_name",
      "same_player_twice",
    ]);
  });

  it("accepte un Google Sheets reel avec Joueur 1 / Joueur 2, SURNOM facultatif vide et colonnes bonus ignorees", () => {
    const sheetsPaste = [
      "Joueur 1 / Joueur 2\tSURNOM\tBodycount",
      "Angèle / Kamila\tTeam bouder\t22",
      "Chahe/Antonin\t\t",
      "Elie/ Naël\t\t",
      "nico/br7\t\t4",
      "Lenny /dona\tPlus besoin de les présenter\t",
    ].join("\n");

    const parsed = parseRegistrationsFromText(sheetsPaste);
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.hasHeaderRow).toBe(true);
    expect(parsed.rowErrors).toHaveLength(0);
    expect(parsed.duplicates).toHaveLength(0);
    expect(parsed.validRows).toHaveLength(5);

    expect(parsed.validRows[0]?.player1Name).toBe("Angèle");
    expect(parsed.validRows[0]?.player2Name).toBe("Kamila");
    expect(parsed.validRows[0]?.teamName).toBe("Team bouder");

    // Sans surnom : nom d'equipe rempli automatiquement par Joueur 1 / Joueur 2
    expect(parsed.validRows[1]?.player1Name).toBe("Chahe");
    expect(parsed.validRows[1]?.player2Name).toBe("Antonin");
    expect(parsed.validRows[1]?.teamName).toBe("Chahe / Antonin");

    expect(parsed.validRows[3]?.player1Name).toBe("nico");
    expect(parsed.validRows[3]?.player2Name).toBe("br7");
    expect(parsed.validRows[3]?.teamName).toBe("nico / br7");

    expect(parsed.validRows[4]?.player1Name).toBe("Lenny");
    expect(parsed.validRows[4]?.player2Name).toBe("dona");
    expect(parsed.validRows[4]?.teamName).toBe("Plus besoin de les présenter");
  });

  it("detecte aussi les surnoms lors d'un collage SANS en-tete meme si la 1re ligne n'a pas de surnom", () => {
    const headerlessPaste = [
      "Chahe/Antonin",
      "Angèle / Kamila\tTeam bouder\t22",
      "nico/br7\t\t4",
      "Lenny /dona\tPlus besoin de les présenter\t",
    ].join("\n");

    const parsed = parseRegistrationsFromText(headerlessPaste);
    expect(parsed.hasHeaderRow).toBe(false);
    expect(parsed.rowErrors).toHaveLength(0);
    expect(parsed.validRows).toHaveLength(4);
    expect(parsed.validRows[0]?.teamName).toBe("Chahe / Antonin");
    expect(parsed.validRows[1]?.teamName).toBe("Team bouder");
    expect(parsed.validRows[2]?.teamName).toBe("nico / br7");
    expect(parsed.validRows[3]?.teamName).toBe("Plus besoin de les présenter");
  });

  it("convertit une URL Google Sheets valide et bloque toute URL hors docs.google.com (anti-SSRF)", () => {
    const converted = resolveGoogleSheetsCsvUrl(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit#gid=42",
    );
    expect(converted).toBe(
      "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/export?format=csv&gid=42",
    );

    expect(() =>
      resolveGoogleSheetsCsvUrl("http://169.254.169.254/latest/meta-data"),
    ).toThrow();
    expect(() =>
      resolveGoogleSheetsCsvUrl("https://evil.example.com/spreadsheets/d/123"),
    ).toThrow();
  });
});

describe("Generation deterministe des poules (pair et impair) et assignation des tables", () => {
  it("genere exactement 5 poules de 4 et 10 tables pour 20 equipes", () => {
    const teams = buildMockTeams(20);
    const planA = generatePoolsAndSchedule(teams);
    const planB = generatePoolsAndSchedule(teams);

    // Determinisme strict
    expect(planA).toEqual(planB);
    expect(planA.startsAtTimeLabel).toBe("18h30");
    expect(planA.pools).toHaveLength(5);
    expect(planA.pools.map((p) => p.size)).toEqual([4, 4, 4, 4, 4]);

    // 5 poules * 6 matchs (3 tours de 2 matchs) = 30 matchs sur les tables 1..10
    expect(planA.matches).toHaveLength(30);
    const usedTables = new Set(planA.matches.map((m) => m.tableNumber));
    expect(usedTables.size).toBe(10);
    expect(Math.min(...usedTables)).toBe(1);
    expect(Math.max(...usedTables)).toBe(10);
  });

  it("gere proprement tous les effectifs impairs et pairs (5, 7, 13, 17, 19, 21 equipes)", () => {
    expect(computeOptimalPoolSizes(5)).toEqual([5]);
    expect(computeOptimalPoolSizes(7)).toEqual([4, 3]);
    expect(computeOptimalPoolSizes(13)).toEqual([4, 3, 3, 3]);
    expect(computeOptimalPoolSizes(17)).toEqual([4, 4, 3, 3, 3]);
    expect(computeOptimalPoolSizes(19)).toEqual([4, 4, 4, 4, 3]);
    expect(computeOptimalPoolSizes(21)).toEqual([4, 4, 4, 3, 3, 3]);

    // Verification sur 19 equipes (impair) : aucune equipe ne joue deux fois au meme tour
    const plan19 = generatePoolsAndSchedule(buildMockTeams(19));
    expect(plan19.pools).toHaveLength(5);

    for (let round = 1; round <= 3; round += 1) {
      const roundMatches = plan19.matches.filter((m) => m.roundNumber === round);
      const seenTeams = new Set<string>();
      for (const match of roundMatches) {
        expect(seenTeams.has(match.teamAId)).toBe(false);
        expect(seenTeams.has(match.teamBId)).toBe(false);
        seenTeams.add(match.teamAId);
        seenTeams.add(match.teamBId);
      }
    }
  });
});

describe("Departage par poule la plus forte, 20 equipes -> 16 qualifies, et seuil des Huitiemes", () => {
  it("qualifie les 3 premiers des 5 poules + le meilleur 4e departage par la poule la plus forte", () => {
    const teams = buildMockTeams(20);
    const plan = generatePoolsAndSchedule(teams);

    // Simulation des 30 matchs de poule :
    // Dans la Poule B (poolNumber = 2) et la Poule D (poolNumber = 4), les equipes classées 4e
    // auront exactement 0 victoire et 410 points marques chacune (egalite parfaite).
    // Mais la Poule D cumule davantage de points totaux que toutes les autres poules :
    // c'est donc le 4e de la Poule D qui doit decrocher l'unique place de meilleur 4e !
    const simulatedMatches: CompletedPoolMatchInput[] = [];

    for (const pool of plan.pools) {
      const t0 = pool.teams[0]?.teamId ?? "";
      const t1 = pool.teams[1]?.teamId ?? "";
      const t2 = pool.teams[2]?.teamId ?? "";
      const t3 = pool.teams[3]?.teamId ?? "";

      let bonusTopMatch = 0;
      if (pool.poolNumber === 4) {
        // Rend la Poule D globalement la plus prolifique en points cumules
        bonusTopMatch = 350;
      }

      let fourthTeamTotalScored = 300;
      if (pool.poolNumber === 2 || pool.poolNumber === 4) {
        // Egalite parfaite entre le 4e de Poule B et le 4e de Poule D : 0 victoire, 410 pts marques
        fourthTeamTotalScored = 410;
      }

      // 6 matchs round-robin deterministes : t0 (3V), t1 (2V), t2 (1V), t3 (0V)
      simulatedMatches.push(
        {
          poolNumber: pool.poolNumber,
          teamAId: t0,
          teamBId: t1,
          scoreTeamA: 650 + bonusTopMatch,
          scoreTeamB: 420,
          status: "completed",
          winnerTeamId: t0,
          forfeitTeamId: null,
        },
        {
          poolNumber: pool.poolNumber,
          teamAId: t0,
          teamBId: t2,
          scoreTeamA: 600,
          scoreTeamB: 380,
          status: "completed",
          winnerTeamId: t0,
          forfeitTeamId: null,
        },
        {
          poolNumber: pool.poolNumber,
          teamAId: t0,
          teamBId: t3,
          scoreTeamA: 580,
          scoreTeamB: 150,
          status: "completed",
          winnerTeamId: t0,
          forfeitTeamId: null,
        },
        {
          poolNumber: pool.poolNumber,
          teamAId: t1,
          teamBId: t2,
          scoreTeamA: 540,
          scoreTeamB: 390,
          status: "completed",
          winnerTeamId: t1,
          forfeitTeamId: null,
        },
        {
          poolNumber: pool.poolNumber,
          teamAId: t1,
          teamBId: t3,
          scoreTeamA: 520,
          scoreTeamB: 130,
          status: "completed",
          winnerTeamId: t1,
          forfeitTeamId: null,
        },
        {
          poolNumber: pool.poolNumber,
          teamAId: t2,
          teamBId: t3,
          scoreTeamA: 510,
          scoreTeamB: fourthTeamTotalScored - 280,
          status: "completed",
          winnerTeamId: t2,
          forfeitTeamId: null,
        },
      );
    }

    const standings = computePoolStandings(plan.pools, teams, simulatedMatches);
    const outcome = resolvePoolQualifications(standings, 12);

    expect(outcome.format.startingPhase).toBe("round_of_16");
    expect(outcome.qualifiedTeams).toHaveLength(16);
    expect(outcome.eliminatedTeams).toHaveLength(4);
    expect(outcome.wildcardRank).toBe(4);

    const bestFourth = outcome.qualifiedTeams.find(
      (q) => q.qualificationReason === "best_wildcards",
    );
    expect(bestFourth).toBeDefined();
    expect(bestFourth?.poolNumber).toBe(4);
    expect(bestFourth?.pointsScored).toBe(410);
  });

  it("impose les Huitiemes de finale des que l'effectif depasse le seuil parametrable (ex: 13 equipes > 12)", () => {
    const format12 = determineKnockoutFormat(12, 12);
    expect(format12.startingPhase).toBe("quarterfinals");
    expect(format12.qualifierCount).toBe(8);

    const format13 = determineKnockoutFormat(13, 12);
    expect(format13.startingPhase).toBe("round_of_16");
    expect(format13.bracketSize).toBe(16);
    expect(format13.qualifierCount).toBe(13);

    // Seuil personnalise a 10 par l'admin : 11 equipes passent obligatoirement en Huitiemes
    const format11Custom = determineKnockoutFormat(11, 10);
    expect(format11Custom.startingPhase).toBe("round_of_16");
    expect(format11Custom.qualifierCount).toBe(11);

    // Verification de la generation de l'arbre a 14 equipes en Huitiemes (2 exempts + 6 vrais matchs en 500 pts)
    const teams14 = buildMockTeams(14);
    const plan14 = generatePoolsAndSchedule(teams14);
    const standings14 = computePoolStandings(plan14.pools, teams14, []);
    const outcome14 = resolvePoolQualifications(standings14, 12);
    const bracket14 = generateKnockoutBracket({
      format: outcome14.format,
      qualifiedTeams: outcome14.qualifiedTeams,
    });

    const r16Matches = bracket14.filter((n) => n.phase === "round_of_16");
    const qfMatches = bracket14.filter((n) => n.phase === "quarterfinals");
    const sfMatches = bracket14.filter((n) => n.phase === "semifinals");
    const finalMatches = bracket14.filter((n) => n.phase === "final");

    expect(r16Matches).toHaveLength(8);
    expect(r16Matches.filter((m) => m.status === "bye")).toHaveLength(2);
    expect(r16Matches.filter((m) => m.status === "pending")).toHaveLength(6);
    expect(r16Matches[0]?.targetScore).toBe(500);
    expect(qfMatches[0]?.targetScore).toBe(600);
    expect(sfMatches[0]?.targetScore).toBe(700);
    expect(finalMatches[0]?.targetScore).toBe(1000);
  });
});

describe("Regles officielles de marque Coinch'Eirb et 6e donne de departage", () => {
  it("calcule exactement Coinche, Surcoinche, Capot, Generale, Belote (>=100) et Parlante", () => {
    // 130 coinche passe = 260, adversaire 0
    const coinchePassed = calculateCoincheDealScore({
      takerSide: "team_a",
      contractKind: "points",
      contractPoints: 130,
      multiplier: "coinche",
      passed: true,
    });
    expect(coinchePassed.pointsTeamA).toBe(260);
    expect(coinchePassed.pointsTeamB).toBe(0);

    // 130 coinche chute = 0 pour le preneur, 320 pour l'adversaire
    const coincheFailed = calculateCoincheDealScore({
      takerSide: "team_a",
      contractKind: "points",
      contractPoints: 130,
      multiplier: "coinche",
      passed: false,
    });
    expect(coincheFailed.pointsTeamA).toBe(0);
    expect(coincheFailed.pointsTeamB).toBe(320);

    // Surcoinche chutee = 640
    const surcoincheFailed = calculateCoincheDealScore({
      takerSide: "team_b",
      contractKind: "points",
      contractPoints: 100,
      multiplier: "surcoinche",
      passed: false,
    });
    expect(surcoincheFailed.pointsTeamA).toBe(640);
    expect(surcoincheFailed.pointsTeamB).toBe(0);

    // Capot = 250, Generale = 500 + 1 parlante adverse (+160)
    const capotScore = calculateCoincheDealScore({
      takerSide: "team_a",
      contractKind: "capot",
      multiplier: "normal",
      passed: true,
    });
    expect(capotScore.pointsTeamA).toBe(250);

    const generaleWithParlante = calculateCoincheDealScore({
      takerSide: "team_b",
      contractKind: "generale",
      multiplier: "normal",
      passed: true,
      parlanteCountForTakerOpponent: 1,
    });
    expect(generaleWithParlante.pointsTeamB).toBe(500);
    expect(generaleWithParlante.pointsTeamA).toBe(160);

    // Belote : abaisse le contrat a partir de 100 uniquement
    expect(computeEffectiveContractThreshold(90, true)).toBe(90);
    expect(computeEffectiveContractThreshold(100, true)).toBe(80);
  });

  it("declenche la 6e donne en cas d'egalite apres 5 donnes en poule", () => {
    const tiedAtFive = evaluateMatchProgress({
      phase: "pool",
      scoreTeamA: 320,
      scoreTeamB: 320,
      dealsPlayed: 5,
      dealsPerPoolMatch: 5,
    });
    expect(tiedAtFive.status).toBe("in_progress");
    expect(tiedAtFive.requiresTiebreakerDeal).toBe(true);

    const resolvedAtSix = evaluateMatchProgress({
      phase: "pool",
      scoreTeamA: 450,
      scoreTeamB: 320,
      dealsPlayed: 6,
      dealsPerPoolMatch: 5,
    });
    expect(resolvedAtSix.status).toBe("completed");
    expect(resolvedAtSix.winnerSide).toBe("team_a");
    expect(resolvedAtSix.requiresTiebreakerDeal).toBe(false);
  });

  it("recherche instantanement un binome par simple prenom et genere automatiquement l'arbre final quand toutes les poules finissent", () => {
    const state = createDefaultUnifiedTournamentState();

    // 1. Recherche par simple prenom (insensible a la casse et aux accents)
    const foundCamille = searchTeamsByFirstName(state.teams, "camille");
    expect(foundCamille.length).toBeGreaterThanOrEqual(1);
    expect(foundCamille[0]?.matchedPlayerName).toBe("Camille Durand");
    expect(foundCamille[0]?.partnerName).toBe("Lucas Martin");

    // 2. Cloture de tous les matchs de poule -> l'arbre final doit se generer automatiquement sans intervention admin
    const allPoolDoneState = {
      ...state,
      matches: state.matches.map((m) => {
        if (m.phase === "pool" && m.status !== "completed") {
          return {
            ...m,
            scoreTeamA: 420,
            scoreTeamB: 260,
            dealsPlayed: 5,
            status: "completed" as const,
            winnerTeamId: m.teamAId,
          };
        }
        return m;
      }),
    };

    const advanced = autoAdvanceTournamentStage(allPoolDoneState);
    expect(advanced.tournament.status).toBe("round_of_16");
    const r16Matches = advanced.matches.filter((m) => m.phase === "round_of_16");
    const finalMatches = advanced.matches.filter((m) => m.phase === "final");
    expect(r16Matches).toHaveLength(8);
    expect(finalMatches).toHaveLength(1);
    expect(r16Matches.every((m) => m.status === "in_progress")).toBe(true);
  });
});
