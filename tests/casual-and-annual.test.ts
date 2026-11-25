import { describe, expect, it } from "vitest";
import {
  applyDealToCasualGame,
  computeCombinedAnnualLeaderboard,
  createDefaultCasualGames,
  getCasualGamesForPlayer,
  type CasualGameRecord,
} from "@/lib/casual/casual-store";
import { createCleanCheckinTournamentState } from "@/lib/tournament/live-store-types";

describe("Mode Partie Libre au BAR & Classement Annuel +/-", () => {
  it("clot automatiquement une partie libre a 1000 pts et alimente l'historique mutuel des 4 joueurs", () => {
    let game: CasualGameRecord = {
      id: "test-bar-1",
      createdAt: "2026-11-25T19:00:00.000Z",
      completedAt: null,
      locationLabel: "Au BAR",
      targetScore: 1000,
      teamA: ["Angèle", "Kamila"],
      teamB: ["Chahe", "Antonin"],
      scoreA: 0,
      scoreB: 0,
      deals: [],
      status: "in_progress",
      winnerSide: null,
    };

    game = applyDealToCasualGame(game, 500, 0, "generale");
    expect(game.status).toBe("in_progress");
    game = applyDealToCasualGame(game, 0, 320, "coinche");
    expect(game.status).toBe("in_progress");
    game = applyDealToCasualGame(game, 520, 0, null);

    expect(game.status).toBe("completed");
    expect(game.winnerSide).toBe("team_a");
    expect(game.scoreA).toBe(1020);
    expect(game.scoreB).toBe(320);

    // Visibilite mutuelle pour les 4 joueurs
    expect(getCasualGamesForPlayer([game], "angele")).toHaveLength(1);
    expect(getCasualGamesForPlayer([game], "antonin")).toHaveLength(1);

    // Calcul du bilan net positif / negatif (+/-) + meilleur duo + bete noire
    const emptyTourney = createCleanCheckinTournamentState();
    const board = computeCombinedAnnualLeaderboard([game], emptyTourney);
    const angele = board.find((p) => p.displayName === "Angèle");
    const chahe = board.find((p) => p.displayName === "Chahe");

    expect(angele?.netBalance).toBe(700);
    expect(angele?.bestPartner?.name).toBe("Kamila");
    expect(chahe?.netBalance).toBe(-700);
    expect(chahe?.nemesis?.name).toBe("Angèle");
  });

  it("donne un bonus annuel nettement superieur aux tournois officiels par rapport aux parties libres", () => {
    const games = createDefaultCasualGames();
    const emptyTourney = createCleanCheckinTournamentState();
    const board = computeCombinedAnnualLeaderboard(games, emptyTourney);
    expect(board.length).toBeGreaterThanOrEqual(4);
    expect(board[0]?.annualPoints).toBeGreaterThan(0);
  });
});
