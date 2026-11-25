import { describe, expect, it } from "vitest";
import {
  createSignedClubAccountToken,
  createSignedTableScorerToken,
  verifySignedClubAccountToken,
  verifySignedTableScorerToken,
} from "@/lib/auth/session";
import {
  deriveTableAccessCode,
  doesClubAccountPlayAtTable,
  evaluateTableScorerAccess,
} from "@/lib/auth/table-code";

const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Comptes club (pseudo+mdp) et verrouillage anti-troll des tables", () => {
  it("genere un code table deterministe de 4 caracteres non ambigus", () => {
    const c1 = deriveTableAccessCode("match-pool-1-r1-t1", 1);
    const c2 = deriveTableAccessCode("match-pool-1-r1-t1", 1);
    const c3 = deriveTableAccessCode("match-pool-1-r1-t2", 2);

    expect(c1).toHaveLength(4);
    expect(c1).toBe(c2);
    expect(c1).not.toBe(c3);
    expect(c1).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it("signe et verifie les jetons HMAC de compte joueur et de telephone marqueur", () => {
    const now = Date.now();
    const accToken = createSignedClubAccountToken(
      {
        accountId: "acc-1",
        pseudo: "Angele_EIRB",
        firstName: "Angèle",
        schoolYear: "2026-2027",
      },
      TEST_SECRET,
      now,
      3600,
    );

    const decodedAcc = verifySignedClubAccountToken(accToken, TEST_SECRET, now);
    expect(decodedAcc?.pseudo).toBe("Angele_EIRB");
    expect(verifySignedClubAccountToken(`${accToken}x`, TEST_SECRET, now)).toBeNull();
    expect(
      verifySignedClubAccountToken(accToken, TEST_SECRET, now + 4_000_000),
    ).toBeNull();

    const scorerToken = createSignedTableScorerToken(
      {
        matchId: "match-1",
        tableCode: "K7M4",
        holderId: "phone-abc",
        holderLabel: "Table 1",
        lockVersion: 1,
      },
      TEST_SECRET,
      now,
      3600,
    );
    const decodedScorer = verifySignedTableScorerToken(
      scorerToken,
      TEST_SECRET,
      now,
    );
    expect(decodedScorer?.holderId).toBe("phone-abc");
    expect(decodedScorer?.lockVersion).toBe(1);
  });

  it("applique strictement la politique anti-troll (compte a la table, 1er marqueur, blocage autres phones, liberation admin)", () => {
    expect(
      doesClubAccountPlayAtTable({
        accountPseudo: "Angele99",
        accountFirstName: "Angèle",
        tablePlayerNames: ["Angele", "Kamila", "Gaston", "Jules"],
      }),
    ).toBe(true);

    // 1. Invite sans code -> demande le code table
    const guestNeedsCode = evaluateTableScorerAccess({
      isAdmin: false,
      accountPlayingAtTable: false,
      matchId: "match-1",
      cookieMatchId: null,
      cookieHolderId: null,
      cookieLockVersion: null,
      activeLockHolderId: null,
      activeLockVersion: 1,
    });
    expect(guestNeedsCode.canEdit).toBe(false);
    expect(guestNeedsCode.status).toBe("requires_code");

    // 2. Invite ayant valide le code -> autorise
    const validHolder = evaluateTableScorerAccess({
      isAdmin: false,
      accountPlayingAtTable: false,
      matchId: "match-1",
      cookieMatchId: "match-1",
      cookieHolderId: "phone-1",
      cookieLockVersion: 1,
      activeLockHolderId: "phone-1",
      activeLockVersion: 1,
    });
    expect(validHolder.canEdit).toBe(true);
    expect(validHolder.status).toBe("authorized_code_holder");

    // 3. Un autre telephone tente d'ouvrir la table -> bloque (anti-troll)
    const trollPhone = evaluateTableScorerAccess({
      isAdmin: false,
      accountPlayingAtTable: false,
      matchId: "match-1",
      cookieMatchId: null,
      cookieHolderId: null,
      cookieLockVersion: null,
      activeLockHolderId: "phone-1",
      activeLockVersion: 1,
    });
    expect(trollPhone.canEdit).toBe(false);
    expect(trollPhone.status).toBe("locked_other_phone");

    // 4. L'admin libere la table (lockVersion passe a 2) -> l'ancien cookie est immediatement invalide
    const oldHolderAfterRelease = evaluateTableScorerAccess({
      isAdmin: false,
      accountPlayingAtTable: false,
      matchId: "match-1",
      cookieMatchId: "match-1",
      cookieHolderId: "phone-1",
      cookieLockVersion: 1,
      activeLockHolderId: null,
      activeLockVersion: 2,
    });
    expect(oldHolderAfterRelease.canEdit).toBe(false);
    expect(oldHolderAfterRelease.status).toBe("requires_code");

    // 5. Un joueur connecte qui joue a cette table passe directement sans code
    const verifiedPlayer = evaluateTableScorerAccess({
      isAdmin: false,
      accountPlayingAtTable: true,
      matchId: "match-1",
      cookieMatchId: null,
      cookieHolderId: null,
      cookieLockVersion: null,
      activeLockHolderId: "phone-1",
      activeLockVersion: 1,
    });
    expect(verifiedPlayer.canEdit).toBe(true);
    expect(verifiedPlayer.status).toBe("authorized_account");
  });
});
