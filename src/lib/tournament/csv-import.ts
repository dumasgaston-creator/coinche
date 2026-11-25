import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import type {
  ImportDuplicateIssue,
  ImportRowError,
  ParsedRegistrationResult,
  RawImportedTeamRow,
} from "@/lib/tournament/types";

const TEAM_HEADER_KEYWORDS = [
  "nom d equipe",
  "nom de l equipe",
  "nom equipe",
  "pseudo d equipe",
  "pseudo equipe",
  "surnom",
  "nickname",
  "blase",
  "equipe",
  "team name",
  "team",
];

const COMBINED_PLAYERS_HEADER_KEYWORDS = [
  "joueur 1 joueur 2",
  "j1 j2",
  "joueurs",
  "binome",
  "binomes",
  "participants",
  "membres",
  "paire",
  "duo",
  "players",
];

const PLAYER_1_HEADER_KEYWORDS = [
  "joueur 1",
  "participant 1",
  "membre 1",
  "coequipier 1",
  "capitaine",
  "nom joueur 1",
  "prenom nom 1",
  "player 1",
  "prenom 1",
];

const PLAYER_2_HEADER_KEYWORDS = [
  "joueur 2",
  "participant 2",
  "membre 2",
  "coequipier 2",
  "partenaire",
  "nom joueur 2",
  "prenom nom 2",
  "player 2",
  "prenom 2",
];

const IGNORED_HEADER_KEYWORDS = [
  "horodateur",
  "timestamp",
  "date",
  "email",
  "adresse e mail",
  "bodycount",
  "commentaire",
  "note",
  "telephone",
  "tel",
  "promo",
  "filiere",
];

/**
 * Valide et convertit un lien Google Sheets (edition ou publication) en URL d'export CSV directe.
 * Protege contre le SSRF en exigeant strictement `https://docs.google.com/spreadsheets/`.
 */
export function resolveGoogleSheetsCsvUrl(rawUrl: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL Google Sheets invalide.");
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error("Seules les URLs HTTPS Google Sheets sont autorisees.");
  }

  if (parsedUrl.hostname !== "docs.google.com") {
    throw new Error(
      "Domaine non autorise : seul docs.google.com est accepte pour l'import.",
    );
  }

  if (
    parsedUrl.pathname.includes("/spreadsheets/d/e/") &&
    parsedUrl.pathname.endsWith("/pub")
  ) {
    parsedUrl.searchParams.set("output", "csv");
    return parsedUrl.toString();
  }

  const sheetIdMatch = parsedUrl.pathname.match(
    /^\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/,
  );
  if (sheetIdMatch === null) {
    throw new Error(
      "Lien Google Sheets non reconnu. Utilisez un lien de partage ou de publication CSV.",
    );
  }

  const sheetId = sheetIdMatch[1];
  let gid = parsedUrl.searchParams.get("gid");
  if (gid === null && parsedUrl.hash.includes("gid=")) {
    const hashMatch = parsedUrl.hash.match(/gid=([0-9]+)/);
    if (hashMatch !== null && hashMatch[1] !== undefined) {
      gid = hashMatch[1];
    }
  }

  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export`,
  );
  exportUrl.searchParams.set("format", "csv");
  if (gid !== null && /^[0-9]+$/.test(gid)) {
    exportUrl.searchParams.set("gid", gid);
  }

  return exportUrl.toString();
}

/**
 * Detecte le separateur dominant sur jusqu'a 60 lignes non vides
 * (tabulation pour copier-coller Google Sheets, `;` ou `,`).
 */
export function detectDelimiter(rawText: string): "," | ";" | "\t" {
  const sampleLines = rawText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 60);

  let tabScore = 0;
  let semiScore = 0;
  let commaScore = 0;

  for (const line of sampleLines) {
    tabScore += line.split("\t").length - 1;
    semiScore += line.split(";").length - 1;
    commaScore += line.split(",").length - 1;
  }

  if (tabScore > 0 && tabScore >= semiScore && tabScore >= commaScore) {
    return "\t";
  }
  if (semiScore > 0 && semiScore >= commaScore) {
    return ";";
  }
  if (commaScore > 0) {
    return ",";
  }
  return "\t";
}

/**
 * Parseur RFC 4180 sans dependance externe gerant les cellules entre guillemets,
 * les guillemets echappes `""` et les retours a la ligne multi-plateformes.
 */
export function parseDelimitedGrid(
  rawText: string,
  delimiter: "," | ";" | "\t",
): Array<{ rowNumber: number; cells: string[] }> {
  const cleaned = rawText.replace(/^\uFEFF/, "");
  const rows: Array<{ rowNumber: number; cells: string[] }> = [];
  let currentCells: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  let currentLineNumber = 1;
  let rowStartLine = 1;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    const nextCh = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === "\n") {
          currentLineNumber += 1;
        }
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentCells.push(currentCell.trim());
        currentCell = "";
      } else if (ch === "\r" && nextCh === "\n") {
        currentCells.push(currentCell.trim());
        rows.push({ rowNumber: rowStartLine, cells: currentCells });
        currentCells = [];
        currentCell = "";
        currentLineNumber += 1;
        rowStartLine = currentLineNumber;
        i += 1;
      } else if (ch === "\n" || ch === "\r") {
        currentCells.push(currentCell.trim());
        rows.push({ rowNumber: rowStartLine, cells: currentCells });
        currentCells = [];
        currentCell = "";
        currentLineNumber += 1;
        rowStartLine = currentLineNumber;
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentCells.length > 0) {
    currentCells.push(currentCell.trim());
    rows.push({ rowNumber: rowStartLine, cells: currentCells });
  }

  return rows.filter((row) => row.cells.some((cell) => cell.length > 0));
}

function matchesAnyKeyword(normalizedCell: string, keywords: string[]): boolean {
  for (const kw of keywords) {
    if (normalizedCell === kw || normalizedCell.includes(kw)) {
      return true;
    }
  }
  return false;
}

function looksLikeDateOrTimestamp(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(trimmed)) {
    return true;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return true;
  }
  return false;
}

function looksLikePureNumber(value: string): boolean {
  return /^[0-9.,\s]+$/.test(value.trim());
}

/**
 * Decoupe une cellule de type "Angèle / Kamila", "Gaston/Jules", "Elie/ Naël",
 * "Martin & Ulysse" ou "Lenny + Dona" en deux noms de joueurs propres.
 * Ignore les dates (ex. "07/05/2026").
 */
export function splitCombinedPlayersCell(
  rawCell: string,
): { player1: string; player2: string } | null {
  const cleaned = rawCell.trim();
  if (cleaned.length === 0 || looksLikeDateOrTimestamp(cleaned)) {
    return null;
  }

  const separators = [/\s*\/\s*/, /\s*&\s*/, /\s*\+\s*/, /\s+et\s+/i, /\s+-\s+/];
  for (const sep of separators) {
    const parts = cleaned
      .split(sep)
      .map((part) => sanitizePlainName(part))
      .filter((part) => part.length > 0);
    if (parts.length >= 2) {
      const p1 = parts[0];
      const p2 = parts.slice(1).join(" / ");
      if (
        p1 !== undefined &&
        p1.length > 0 &&
        p2.length > 0 &&
        !looksLikePureNumber(p1) &&
        !looksLikePureNumber(p2)
      ) {
        return { player1: p1, player2: p2 };
      }
    }
  }

  return null;
}

interface ColumnMapping {
  hasHeaderRow: boolean;
  mode: "separate_players" | "combined_players";
  teamCol: number;
  player1Col: number;
  player2Col: number;
  combinedPlayersCol: number;
}

function resolveColumnMapping(
  allRows: Array<{ rowNumber: number; cells: string[] }>,
): ColumnMapping {
  const firstRowCells = allRows[0]?.cells ?? [];
  const normalizedHeaders = firstRowCells.map((cell) =>
    normalizeComparisonKey(cell),
  );

  let maxCols = 0;
  for (const r of allRows) {
    if (r.cells.length > maxCols) {
      maxCols = r.cells.length;
    }
  }

  let teamCol = -1;
  let player1Col = -1;
  let player2Col = -1;
  let combinedPlayersCol = -1;
  const ignoredCols = new Set<number>();

  for (let idx = 0; idx < normalizedHeaders.length; idx += 1) {
    const header = normalizedHeaders[idx];
    if (header === undefined || header === "") {
      continue;
    }
    if (matchesAnyKeyword(header, IGNORED_HEADER_KEYWORDS)) {
      ignoredCols.add(idx);
      continue;
    }
    if (
      combinedPlayersCol === -1 &&
      matchesAnyKeyword(header, COMBINED_PLAYERS_HEADER_KEYWORDS)
    ) {
      combinedPlayersCol = idx;
      continue;
    }
    if (teamCol === -1 && matchesAnyKeyword(header, TEAM_HEADER_KEYWORDS)) {
      teamCol = idx;
      continue;
    }
    if (
      player1Col === -1 &&
      matchesAnyKeyword(header, PLAYER_1_HEADER_KEYWORDS)
    ) {
      player1Col = idx;
      continue;
    }
    if (
      player2Col === -1 &&
      matchesAnyKeyword(header, PLAYER_2_HEADER_KEYWORDS)
    ) {
      player2Col = idx;
      continue;
    }
  }

  // Cas 1 : En-tete combine "Joueur 1 / Joueur 2" (+ colonne SURNOM facultative)
  if (combinedPlayersCol !== -1) {
    if (teamCol === -1) {
      for (let col = 0; col < maxCols; col += 1) {
        if (col !== combinedPlayersCol && !ignoredCols.has(col)) {
          teamCol = col;
          break;
        }
      }
    }
    return {
      hasHeaderRow: true,
      mode: "combined_players",
      teamCol,
      player1Col: -1,
      player2Col: -1,
      combinedPlayersCol,
    };
  }

  // Cas 2 : En-tetes separes "Joueur 1" & "Joueur 2" (avec ou sans colonne Equipe/Surnom)
  if (player1Col !== -1 && player2Col !== -1) {
    return {
      hasHeaderRow: true,
      mode: "separate_players",
      teamCol,
      player1Col,
      player2Col,
      combinedPlayersCol: -1,
    };
  }

  // Cas 3 : Collage sans en-tete - inspecte TOUTES les colonnes sur jusqu'a 25 lignes
  // pour reperer la colonne "Joueur 1 / Joueur 2" et la colonne surnom facultative.
  const inspectRows = allRows.slice(0, 25);
  let bestCombinedCol = -1;
  let bestCombinedHits = 0;

  for (let col = 0; col < maxCols; col += 1) {
    let hits = 0;
    for (const row of inspectRows) {
      const cell = row.cells[col] ?? "";
      if (splitCombinedPlayersCell(cell) !== null) {
        hits += 1;
      }
    }
    if (hits > bestCombinedHits) {
      bestCombinedHits = hits;
      bestCombinedCol = col;
    }
  }

  if (bestCombinedCol !== -1 && bestCombinedHits > 0) {
    // Cherche la meilleure colonne surnom parmi les autres colonnes non purement numeriques/dates
    let bestNickCol = -1;
    let bestNickTextScore = 0;

    for (let col = 0; col < maxCols; col += 1) {
      if (col === bestCombinedCol) {
        continue;
      }
      let textCells = 0;
      let nonIgnoredCells = 0;
      for (const row of inspectRows) {
        const raw = (row.cells[col] ?? "").trim();
        if (raw.length === 0) {
          continue;
        }
        nonIgnoredCells += 1;
        if (!looksLikeDateOrTimestamp(raw) && !looksLikePureNumber(raw)) {
          textCells += 1;
        }
      }
      if (textCells > bestNickTextScore && nonIgnoredCells > 0) {
        bestNickTextScore = textCells;
        bestNickCol = col;
      }
    }

    if (bestNickCol === -1 && maxCols >= 2) {
      if (bestCombinedCol === 0) {
        bestNickCol = 1;
      } else {
        bestNickCol = 0;
      }
    }

    return {
      hasHeaderRow: false,
      mode: "combined_players",
      teamCol: bestNickCol,
      player1Col: -1,
      player2Col: -1,
      combinedPlayersCol: bestCombinedCol,
    };
  }

  // Cas 4 : 2 colonnes sans en-tete ni slash -> Joueur 1 | Joueur 2 (surnom auto)
  if (maxCols === 2) {
    return {
      hasHeaderRow: false,
      mode: "separate_players",
      teamCol: -1,
      player1Col: 0,
      player2Col: 1,
      combinedPlayersCol: -1,
    };
  }

  // Cas 5 : 3 colonnes sans en-tete -> Nom d'equipe (facultatif) | Joueur 1 | Joueur 2
  return {
    hasHeaderRow: false,
    mode: "separate_players",
    teamCol: 0,
    player1Col: 1,
    player2Col: 2,
    combinedPlayersCol: -1,
  };
}

/**
 * Detecte de maniere deterministe tous les doublons d'equipes et de joueurs
 * (insensible aux majuscules, accents et espaces multiples).
 */
export function detectRegistrationDuplicates(
  rows: RawImportedTeamRow[],
): ImportDuplicateIssue[] {
  const issues: ImportDuplicateIssue[] = [];
  const teamMap = new Map<string, { display: string; rows: number[] }>();
  const playerMap = new Map<string, { display: string; rows: number[] }>();

  for (const row of rows) {
    const existingTeam = teamMap.get(row.normalizedTeamName);
    if (existingTeam === undefined) {
      teamMap.set(row.normalizedTeamName, {
        display: row.teamName,
        rows: [row.rowNumber],
      });
    } else {
      existingTeam.rows.push(row.rowNumber);
    }

    if (row.normalizedPlayer1 === row.normalizedPlayer2) {
      issues.push({
        type: "same_player_twice",
        normalizedKey: row.normalizedPlayer1,
        displayValue: row.player1Name,
        rowNumbers: [row.rowNumber],
        message: `Ligne ${row.rowNumber} : le même joueur (${row.player1Name}) est renseigné deux fois dans le binôme "${row.teamName}".`,
      });
    } else {
      const playersInRow: Array<{ norm: string; raw: string }> = [
        { norm: row.normalizedPlayer1, raw: row.player1Name },
        { norm: row.normalizedPlayer2, raw: row.player2Name },
      ];

      for (const player of playersInRow) {
        const existingPlayer = playerMap.get(player.norm);
        if (existingPlayer === undefined) {
          playerMap.set(player.norm, {
            display: player.raw,
            rows: [row.rowNumber],
          });
        } else {
          existingPlayer.rows.push(row.rowNumber);
        }
      }
    }
  }

  for (const [normKey, info] of teamMap.entries()) {
    if (info.rows.length > 1) {
      issues.push({
        type: "duplicate_team_name",
        normalizedKey: normKey,
        displayValue: info.display,
        rowNumbers: info.rows,
        message: `Nom ou binôme en doublon "${info.display}" aux lignes ${info.rows.join(", ")}.`,
      });
    }
  }

  for (const [normKey, info] of playerMap.entries()) {
    if (info.rows.length > 1) {
      issues.push({
        type: "duplicate_player_name",
        normalizedKey: normKey,
        displayValue: info.display,
        rowNumbers: info.rows,
        message: `Joueur inscrit dans plusieurs binômes "${info.display}" aux lignes ${info.rows.join(", ")}.`,
      });
    }
  }

  return issues;
}

/**
 * Parse un export CSV Google Sheets ou un copier-coller de colonnes sans aucune cle API IA.
 * Souple pour le terrain :
 * - Supporte `Joueur 1 / Joueur 2 | SURNOM` (avec ou sans en-tete, dans n'importe quel ordre)
 * - Supporte aussi `Nom d'equipe | Joueur 1 | Joueur 2` et `Joueur 1 | Joueur 2`
 * - Ignore les colonnes bonus (ex. Horodateur, Bodycount) et les lignes vides
 * - Si le surnom / nom d'equipe est vide, remplit automatiquement `Joueur 1 / Joueur 2`.
 */
export function parseRegistrationsFromText(
  rawText: string,
): ParsedRegistrationResult {
  const delimiter = detectDelimiter(rawText);
  const allRows = parseDelimitedGrid(rawText, delimiter);

  const firstRow = allRows[0];
  if (firstRow === undefined) {
    return {
      delimiter,
      hasHeaderRow: false,
      validRows: [],
      duplicates: [],
      rowErrors: [],
    };
  }

  const mapping = resolveColumnMapping(allRows);
  let startIndex = 0;
  if (mapping.hasHeaderRow) {
    startIndex = 1;
  }

  const validRows: RawImportedTeamRow[] = [];
  const rowErrors: ImportRowError[] = [];

  for (let i = startIndex; i < allRows.length; i += 1) {
    const row = allRows[i];
    if (row === undefined) {
      continue;
    }

    let rawTeam = "";
    if (mapping.teamCol >= 0) {
      rawTeam = row.cells[mapping.teamCol] ?? "";
    }

    let player1Name = "";
    let player2Name = "";

    if (mapping.mode === "combined_players") {
      const combinedCell = row.cells[mapping.combinedPlayersCol] ?? "";
      const split = splitCombinedPlayersCell(combinedCell);
      if (split !== null) {
        player1Name = split.player1;
        player2Name = split.player2;
      } else {
        const cleanSingle = sanitizePlainName(combinedCell);
        if (cleanSingle.length === 0) {
          continue;
        }
        // Tolérance supplémentaire : si l'admin a saisi "Prénom1 Prénom2" séparés par un espace simple
        const spaceParts = cleanSingle.split(/\s+/).filter((p) => p.length > 0);
        if (spaceParts.length === 2 && spaceParts[0] !== undefined && spaceParts[1] !== undefined) {
          player1Name = spaceParts[0];
          player2Name = spaceParts[1];
        } else {
          rowErrors.push({
            rowNumber: row.rowNumber,
            rawCells: row.cells,
            reason: `Séparez les deux prénoms par "/" ou "&" (ex. "${cleanSingle} / Partenaire").`,
          });
          continue;
        }
      }
    } else {
      const rawP1 = row.cells[mapping.player1Col] ?? "";
      const rawP2 = row.cells[mapping.player2Col] ?? "";
      player1Name = sanitizePlainName(rawP1);
      player2Name = sanitizePlainName(rawP2);
    }

    if (player1Name.length < 1 || player2Name.length < 1) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        rawCells: row.cells,
        reason:
          "Chaque ligne doit comporter au moins les noms de Joueur 1 et Joueur 2.",
      });
      continue;
    }

    let teamName = sanitizePlainName(rawTeam);
    if (teamName.length === 0 || normalizeComparisonKey(teamName) === "") {
      teamName = `${player1Name} / ${player2Name}`;
    }

    if (teamName.length > 60) {
      teamName = teamName.slice(0, 60).trim();
    }
    if (player1Name.length > 60) {
      player1Name = player1Name.slice(0, 60).trim();
    }
    if (player2Name.length > 60) {
      player2Name = player2Name.slice(0, 60).trim();
    }

    const normalizedTeamName = normalizeComparisonKey(teamName);
    const normalizedPlayer1 = normalizeComparisonKey(player1Name);
    const normalizedPlayer2 = normalizeComparisonKey(player2Name);

    if (normalizedPlayer1 === "" || normalizedPlayer2 === "") {
      rowErrors.push({
        rowNumber: row.rowNumber,
        rawCells: row.cells,
        reason:
          "Les noms des joueurs doivent contenir des caractères alphanumériques valides.",
      });
      continue;
    }

    validRows.push({
      rowNumber: row.rowNumber,
      teamName,
      normalizedTeamName:
        normalizedTeamName || `${normalizedPlayer1} ${normalizedPlayer2}`,
      player1Name,
      player2Name,
      normalizedPlayer1,
      normalizedPlayer2,
    });
  }

  const duplicates = detectRegistrationDuplicates(validRows);

  return {
    delimiter,
    hasHeaderRow: mapping.hasHeaderRow,
    validRows,
    duplicates,
    rowErrors,
  };
}
