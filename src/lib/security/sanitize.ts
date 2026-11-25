const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Echappe les caracteres HTML dangereux dans toute chaine issue d'une saisie utilisateur.
 */
export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (char) => {
    const mapped = HTML_ESCAPE_MAP[char];
    if (mapped !== undefined) {
      return mapped;
    }
    return char;
  });
}

/**
 * Nettoie un texte d'affichage : supprime les caracteres de controle invisibles,
 * remplace les tirets cadratins eventuels par un tiret simple et compresse les espaces.
 */
export function sanitizeDisplayText(raw: string): string {
  const withoutControl = raw
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\u2014\u2013]/g, "-");
  const collapsed = withoutControl.replace(/\s+/g, " ").trim();
  return escapeHtml(collapsed);
}

/**
 * Nettoie un nom propre ou nom d'equipe sans entites HTML pour le stockage SQL parametre,
 * tout en eliminant balises chevrons, caracteres de controle et tirets cadratins.
 */
export function sanitizePlainName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Produit une cle canonique sans accents ni casse pour la detection deterministe des doublons.
 */
export function normalizeComparisonKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Hache une adresse IP avec un sel serveur (FNV-1a 256-bit multi-lanes deterministe
 * compatible navigateur, Edge et Node.js sans dependre de `node:crypto` dans les bundles clients)
 * afin de journaliser et limiter le debit sans conserver d'adresse IP brute en base.
 */
export function hashClientIdentifier(rawIp: string, salt: string): string {
  const input = `${salt}:${rawIp.trim()}`;
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  let hex = "";

  for (let lane = 0; lane < seeds.length; lane += 1) {
    let h = seeds[lane] ?? 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i) + lane * 31;
      h = Math.imul(h, 0x01000193);
    }
    hex += (h >>> 0).toString(16).padStart(8, "0");
  }

  return hex.slice(0, 32);
}
