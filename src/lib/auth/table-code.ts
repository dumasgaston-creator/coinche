import { normalizeComparisonKey } from "@/lib/security/sanitize";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Genere un code court deterministe a 4 caracteres (sans 0/O/1/I ambigus)
 * pour chaque table/match, visible dans `/admin` pour verrouiller le telephone marqueur.
 */
export function deriveTableAccessCode(
  matchId: string,
  tableNumber: number | null,
): string {
  const seed = `coincheirb-table:${matchId}:${tableNumber ?? 0}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let out = "";
  let cursor = hash >>> 0;
  for (let idx = 0; idx < 4; idx += 1) {
    const charIndex = cursor % CODE_ALPHABET.length;
    out += CODE_ALPHABET[charIndex] ?? "K";
    cursor = Math.imul(cursor ^ (idx + 31), 2654435761) >>> 0;
  }
  return out;
}

export function normalizeTableCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

/**
 * Verifie si un compte joueur authentifie correspond a l'un des 4 joueurs assis a la table.
 */
export function doesClubAccountPlayAtTable(params: {
  accountPseudo: string;
  accountFirstName: string;
  tablePlayerNames: readonly string[];
}): boolean {
  const normPseudo = normalizeComparisonKey(params.accountPseudo);
  const normFirst = normalizeComparisonKey(params.accountFirstName);

  for (const playerName of params.tablePlayerNames) {
    const normPlayer = normalizeComparisonKey(playerName);
    if (normPlayer.length < 2) {
      continue;
    }
    if (normPlayer === normPseudo || normPlayer === normFirst) {
      return true;
    }
    const firstWord = normPlayer.split(" ")[0] ?? "";
    if (firstWord.length >= 2 && firstWord === normFirst) {
      return true;
    }
  }
  return false;
}

export type TableScorerAccessStatus =
  | "authorized_admin"
  | "authorized_account"
  | "authorized_code_holder"
  | "requires_code"
  | "locked_other_phone";

export interface TableScorerAccessEvaluation {
  canEdit: boolean;
  status: TableScorerAccessStatus;
  reason: string;
}

/**
 * Politique pure anti-troll d'acces en ecriture a une table :
 * 1. L'Admin a toujours la main.
 * 2. Un joueur connecte a son compte (`pseudo + mdp`) qui joue a cette table a la main directement.
 * 3. Un invite qui detient le cookie signe `TABLE_SCORER` pour ce match et cette `lockVersion` a la main.
 * 4. Si un autre telephone detient deja le verrou actif -> bloque (`locked_other_phone`).
 * 5. Sinon -> demande le code table a 4 caracteres (`requires_code`).
 */
export function evaluateTableScorerAccess(params: {
  isAdmin: boolean;
  accountPlayingAtTable: boolean;
  matchId: string;
  cookieMatchId: string | null;
  cookieHolderId: string | null;
  cookieLockVersion: number | null;
  activeLockHolderId: string | null;
  activeLockVersion: number;
}): TableScorerAccessEvaluation {
  if (params.isAdmin) {
    return {
      canEdit: true,
      status: "authorized_admin",
      reason: "Accès complet Administrateur.",
    };
  }

  if (params.accountPlayingAtTable) {
    return {
      canEdit: true,
      status: "authorized_account",
      reason: "Compte joueur vérifié sur cette table.",
    };
  }

  if (
    params.cookieMatchId === params.matchId &&
    params.cookieHolderId !== null &&
    params.cookieLockVersion === params.activeLockVersion
  ) {
    if (
      params.activeLockHolderId === null ||
      params.activeLockHolderId === params.cookieHolderId
    ) {
      return {
        canEdit: true,
        status: "authorized_code_holder",
        reason: "Téléphone marqueur verrouillé sur cette table.",
      };
    }
  }

  if (
    params.activeLockHolderId !== null &&
    params.activeLockHolderId !== params.cookieHolderId
  ) {
    return {
      canEdit: false,
      status: "locked_other_phone",
      reason:
        "Cette table est déjà saisie par un autre téléphone marqueur. Demandez à l'admin de libérer la table si besoin.",
    };
  }

  return {
    canEdit: false,
    status: "requires_code",
    reason:
      "Entrez le code Table à 4 caractères (affiché en /admin) ou connectez-vous à votre compte joueur pour saisir les scores.",
  };
}
