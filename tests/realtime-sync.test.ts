import { describe, expect, it } from "vitest";
import { createDefaultUnifiedTournamentState } from "@/lib/tournament/live-store-types";
import {
  ReducerLockError,
  applyDirectFinalScoreReducer,
  applyRecordDealReducer,
  applyTableAlertReducer,
  isValidUnifiedTournamentState,
} from "@/lib/tournament/state-reducers";

describe("Synchronisation temps reel & Reducers atomiques serveur", () => {
  it("preserve les saisies simultanees de deux tables differentes sans ecrasement", () => {
    const initial = createDefaultUnifiedTournamentState(12);
    const poolMatches = initial.matches.filter(
      (m) => m.phase === "pool" && m.status === "in_progress",
    );
    expect(poolMatches.length).toBeGreaterThanOrEqual(2);

    const match1 = poolMatches[0]!;
    const match2 = poolMatches[1]!;
    const baseM1A = match1.scoreTeamA;
    const baseM1B = match1.scoreTeamB;
    const baseM2A = match2.scoreTeamA;
    const baseM2B = match2.scoreTeamB;

    const afterTable1 = applyRecordDealReducer(initial, {
      matchId: match1.id,
      pointsTeamA: 120,
      pointsTeamB: 42,
      specialAnnouncement: null,
      announcementOutcome: null,
      parlantePenalty: false,
    });

    const afterTable2 = applyRecordDealReducer(afterTable1.nextState, {
      matchId: match2.id,
      pointsTeamA: 0,
      pointsTeamB: 160,
      specialAnnouncement: "coinche",
      announcementOutcome: "failed",
      parlantePenalty: false,
    });

    const m1Final = afterTable2.nextState.matches.find(
      (m) => m.id === match1.id,
    );
    const m2Final = afterTable2.nextState.matches.find(
      (m) => m.id === match2.id,
    );

    expect(m1Final?.scoreTeamA).toBe(baseM1A + 120);
    expect(m1Final?.scoreTeamB).toBe(baseM1B + 42);
    expect(m2Final?.scoreTeamA).toBe(baseM2A);
    expect(m2Final?.scoreTeamB).toBe(baseM2B + 160);
    expect(isValidUnifiedTournamentState(afterTable2.nextState)).toBe(true);
  });

  it("refuse (423 Locked) toute ecriture joueur si l'admin a verrouille la saisie ou la table", () => {
    const initial = createDefaultUnifiedTournamentState(8);
    const targetMatch = initial.matches[0]!;
    const baseTargetA = targetMatch.scoreTeamA;

    const globallyLocked = {
      ...initial,
      tournament: {
        ...initial.tournament,
        playerScoreEditingEnabled: false,
      },
    };

    expect(() =>
      applyRecordDealReducer(globallyLocked, {
        matchId: targetMatch.id,
        pointsTeamA: 100,
        pointsTeamB: 62,
        specialAnnouncement: null,
        announcementOutcome: null,
        parlantePenalty: false,
      }),
    ).toThrow(ReducerLockError);

    // L'administrateur avec bypassLock reste autorise
    const adminBypass = applyRecordDealReducer(globallyLocked, {
      matchId: targetMatch.id,
      pointsTeamA: 100,
      pointsTeamB: 62,
      specialAnnouncement: null,
      announcementOutcome: null,
      parlantePenalty: false,
      bypassLock: true,
    });
    expect(
      adminBypass.nextState.matches.find((m) => m.id === targetMatch.id)
        ?.scoreTeamA,
    ).toBe(baseTargetA + 100);
  });

  it("genere automatiquement les phases finales et declenche le pop-up Capri-Seum en elimination", () => {
    let state = createDefaultUnifiedTournamentState(8);
    const poolIds = state.matches
      .filter((m) => m.phase === "pool")
      .map((m) => m.id);

    for (const poolMatchId of poolIds) {
      const outcome = applyDirectFinalScoreReducer(state, {
        matchId: poolMatchId,
        scoreTeamA: 420,
        scoreTeamB: 210,
      });
      state = outcome.nextState;
    }

    const koMatches = state.matches.filter((m) => m.phase !== "pool");
    expect(koMatches.length).toBeGreaterThan(0);

    const activeKo = koMatches.find(
      (m) => m.status === "in_progress" && m.phase !== "final",
    );
    expect(activeKo).toBeDefined();

    if (activeKo !== undefined) {
      const elimOutcome = applyDirectFinalScoreReducer(state, {
        matchId: activeKo.id,
        scoreTeamA: 620,
        scoreTeamB: 240,
      });
      expect(elimOutcome.popupEvent).not.toBeNull();
      expect(elimOutcome.popupEvent?.specialKind).toBe("elimination");
    }
  });

  it("bloque toute tentative d'alerte ou forfait sur une table etrangere (anti-IDOR)", () => {
    const state = createDefaultUnifiedTournamentState(8);
    const targetMatch = state.matches[0]!;
    const foreignTeam = state.teams.find(
      (t) => t.id !== targetMatch.teamAId && t.id !== targetMatch.teamBId,
    );
    expect(foreignTeam).toBeDefined();

    if (foreignTeam !== undefined) {
      expect(() =>
        applyTableAlertReducer(state, {
          matchId: targetMatch.id,
          tableNumber: targetMatch.tableNumber ?? 1,
          teamId: foreignTeam.id,
          teamName: foreignTeam.teamName,
          alertType: "abandon_request",
          message: "Tentative IDOR",
          applyImmediateForfeit: true,
        }),
      ).toThrow(ReducerLockError);
    }
  });
});
