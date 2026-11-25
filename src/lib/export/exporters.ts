import type {
  AnnualPlayerStanding,
  ClassementFullDataset,
  KnockoutMatchView,
  TeamBinomeMeta,
} from "@/components/classement/tournament-data";
import type { QualifiedTeamSeed } from "@/lib/tournament/types";

export type CsvExportScope = "all" | "pools" | "knockout" | "annual";

export interface ExportResultFeedback {
  ok: boolean;
  format: "CSV" | "PNG" | "PDF";
  filename: string;
  message: string;
}

/**
 * Echappe une cellule CSV selon la norme RFC 4180 et neutralise toute injection
 * de formule tableur (`=`, `+`, `-`, `@` en debut de chaine Text) pour Excel / LibreOffice.
 */
function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);
  if (typeof value === "string") {
    const firstChar = text.charAt(0);
    if (
      firstChar === "=" ||
      firstChar === "+" ||
      firstChar === "@" ||
      firstChar === "\t" ||
      firstChar === "\r"
    ) {
      text = `'${text}`;
    }
  }

  const needsQuotes =
    text.includes(";") ||
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r");

  if (needsQuotes) {
    const escapedQuotes = text.replace(/"/g, '""');
    return `"${escapedQuotes}"`;
  }

  return text;
}

function formatQualificationBadgeLabel(reason: string | null | undefined): string {
  if (reason === "direct_top_n") {
    return "Qualifié direct Top 3";
  }
  if (reason === "best_wildcards") {
    return "Meilleur 4e qualifié";
  }
  if (reason === "forfeit") {
    return "Forfait";
  }
  return "Éliminé";
}

function formatPhaseLabel(phase: KnockoutMatchView["phase"]): string {
  if (phase === "round_of_16") {
    return "Huitièmes de finale (500 pts)";
  }
  if (phase === "quarterfinals") {
    return "Quarts de finale (600 pts)";
  }
  if (phase === "semifinals") {
    return "Demi-finales (700 pts)";
  }
  return "Finale (1000 pts)";
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2500);
}

function resolveBinomeText(
  teamId: string,
  metaMap: Record<string, TeamBinomeMeta>,
): string {
  const meta = metaMap[teamId];
  if (meta !== undefined) {
    return `${meta.player1Name} & ${meta.player2Name}`;
  }
  return "Binôme Coinch'Eirb";
}

/**
 * 1. Export CSV (`exportTournamentCsv`) :
 * Genere un fichier `.csv` propre encodé en UTF-8 avec BOM (`\uFEFF`) pour une ouverture
 * directe avec accents parfaits dans Excel et LibreOffice Calc.
 */
export function exportTournamentCsv(
  dataset: ClassementFullDataset,
  scope: CsvExportScope = "all",
): ExportResultFeedback {
  const lines: string[] = [];

  const pushRow = (cells: Array<string | number | boolean | null | undefined>) => {
    lines.push(cells.map(escapeCsvCell).join(";"));
  };

  pushRow([
    "COINCH'EIRB - EXPORT OFFICIEL DES CLASSEMENTS",
    dataset.tournamentTitle,
    dataset.eventDateLabel,
    `Année scolaire ${dataset.schoolYear}`,
  ]);
  lines.push("");

  if (scope === "all" || scope === "pools") {
    pushRow(["SECTION 1 - CLASSEMENT DES POULES (A à E) & DÉPARTAGE"]);
    pushRow([
      "Poule",
      "Total Points Poule (Départage)",
      "Rang Poule",
      "Tête de série",
      "Équipe",
      "Binôme",
      "Matchs Joués",
      "Victoires",
      "Défaites",
      "Points Marqués (Goal-Average)",
      "Points Encaissés",
      "Différence",
      "Statut Qualification",
    ]);

    for (const pool of dataset.qualification.pools) {
      for (const row of pool.standings) {
        const qual: QualifiedTeamSeed | undefined =
          dataset.qualifiedLookup[row.teamId];
        let seedText = "-";
        let statusText = "Éliminé";
        if (qual !== undefined) {
          statusText = formatQualificationBadgeLabel(qual.qualificationReason);
          if (qual.bracketSeed !== null) {
            seedText = `#${qual.bracketSeed}`;
          }
        }

        pushRow([
          pool.poolLabel,
          pool.poolTotalPoints,
          row.poolRank,
          seedText,
          row.teamName,
          resolveBinomeText(row.teamId, dataset.teamMetaById),
          row.matchesPlayed,
          row.matchesWon,
          row.matchesLost,
          row.pointsScored,
          row.pointsConceded,
          row.pointsDiff,
          statusText,
        ]);
      }
    }

    lines.push("");
    pushRow([
      "TABLEAU DE DÉPARTAGE DES MEILLEURS 4es (16 qualifiés sur 20 - sans mini-consolante)",
    ]);
    pushRow([
      "Rang 4e",
      "Équipe",
      "Poule",
      "Victoires",
      "Goal-Average (Points Marqués)",
      "Force de la Poule (Total Points Poule)",
      "Différence",
      "Décision",
    ]);

    for (let i = 0; i < dataset.qualification.wildcardCandidatesRanked.length; i += 1) {
      const cand = dataset.qualification.wildcardCandidatesRanked[i];
      if (cand === undefined) {
        continue;
      }
      let decision = "Éliminé (17e–20e)";
      if (cand.qualified) {
        decision = `Qualifié 16e (Tête de série #${cand.bracketSeed ?? 16})`;
      }
      pushRow([
        i + 1,
        cand.teamName,
        cand.poolLabel,
        cand.matchesWon,
        cand.pointsScored,
        cand.poolTotalPoints,
        cand.pointsDiff,
        decision,
      ]);
    }
    lines.push("");
  }

  if (scope === "all" || scope === "knockout") {
    pushRow(["SECTION 2 - ARBRE DES PHASES FINALES (500 / 600 / 700 / 1000 PTS)"]);
    pushRow([
      "Tour",
      "Match #",
      "Table",
      "Score Cible",
      "Tête de série A",
      "Équipe A",
      "Score A",
      "Score B",
      "Équipe B",
      "Tête de série B",
      "Vainqueur",
      "Fait marquant",
    ]);

    for (const match of dataset.knockoutMatches) {
      let winnerName = "En cours";
      if (match.winnerTeamId === match.teamAId) {
        winnerName = match.teamAName;
      } else if (match.winnerTeamId === match.teamBId) {
        winnerName = match.teamBName;
      }

      pushRow([
        formatPhaseLabel(match.phase),
        match.slot,
        `Table ${match.tableNumber}`,
        match.targetScore,
        `#${match.seedA}`,
        match.teamAName,
        match.scoreTeamA,
        match.scoreTeamB,
        match.teamBName,
        `#${match.seedB}`,
        winnerName,
        match.highlightNote ?? "",
      ]);
    }
    lines.push("");
  }

  if (scope === "all" || scope === "annual") {
    pushRow(["SECTION 3 - CLASSEMENT GÉNÉRAL ANNUEL COINCH'EIRB"]);
    pushRow([
      "Rang Annuel",
      "Joueur",
      "Filière",
      "Promotion",
      "Année Scolaire",
      "Points Classement",
      "Tournois Joués",
      "Tournois Gagnés",
      "Matchs Gagnés",
      "Total Points Marqués",
      "Capots Réussis",
      "Générales Réussies",
      "Coinches Passées",
    ]);

    for (const player of dataset.annualPlayers) {
      pushRow([
        player.rank,
        player.displayName,
        player.department,
        player.promotionYear,
        player.schoolYear,
        player.rankingPoints,
        player.tournamentsPlayed,
        player.tournamentsWon,
        `${player.matchesWon}/${player.matchesPlayed}`,
        player.totalPointsScored,
        player.capotsPassed,
        player.generalesPassed,
        player.coinchesPassed,
      ]);
    }
  }

  const csvContent = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = `coincheirb-classement-${scope}-2026-2027.csv`;
  triggerBlobDownload(blob, filename);

  return {
    ok: true,
    format: "CSV",
    filename,
    message: `Fichier CSV (${filename}) généré avec encodage UTF-8 BOM pour Excel et LibreOffice.`,
  };
}

/**
 * Dessine un rectangle a coins arrondis sur un contexte Canvas 2D.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 2. Export PNG haute résolution (`exportStandingsPng`) :
 * Dessine sur un `<canvas>` HTML5 2x Retina (2400 x 1650 px) la planche officielle
 * des résultats Coinch'Eirb aux couleurs de la charte (`#161210`, `#221B17`, `#E8A628`, `#F7F2E8`,
 * `#A64622`, `#2D7D4E`, `#C8342B`) et déclenche le téléchargement direct en `.png`.
 */
export async function exportStandingsPng(
  dataset: ClassementFullDataset,
): Promise<ExportResultFeedback> {
  const canvas = document.createElement("canvas");
  const width = 2400;
  const height = 1660;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return {
      ok: false,
      format: "PNG",
      filename: "",
      message: "Impossible d'initialiser le moteur graphique Canvas 2D.",
    };
  }

  // Fond sombre chaud Coinch'Eirb (#161210)
  ctx.fillStyle = "#161210";
  ctx.fillRect(0, 0, width, height);

  // Bandeau superieur ambre dore (#E8A628)
  ctx.fillStyle = "#E8A628";
  ctx.fillRect(0, 0, width, 14);

  // Cadre d'en-tete (#221B17)
  drawRoundedRect(ctx, 48, 38, width - 96, 148, 18);
  ctx.fillStyle = "#221B17";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#524339";
  ctx.stroke();

  // Pastille marque Coinch'Eirb
  drawRoundedRect(ctx, 76, 64, 96, 96, 16);
  ctx.fillStyle = "#E8A628";
  ctx.fill();

  ctx.fillStyle = "#161210";
  ctx.font = '800 38px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("CE", 124, 125);

  ctx.textAlign = "left";
  ctx.fillStyle = "#E8A628";
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText("ENSEIRB-MATMECA · ASSOCIATION COINCH'EIRB · PLANCHE OFFICIELLE", 196, 86);

  ctx.fillStyle = "#F7F2E8";
  ctx.font = '800 52px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.fillText(dataset.tournamentTitle.toUpperCase(), 196, 138);

  ctx.fillStyle = "#CBBEB0";
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${dataset.eventDateLabel}  ·  20 équipes  ·  5 poules de 4  ·  16 qualifiés en Huitièmes`,
    196,
    168,
  );

  // Enseignes de cartes en haut a droite
  ctx.textAlign = "right";
  ctx.fillStyle = "#E8A628";
  ctx.font = '700 40px "Barlow Condensed", serif';
  ctx.fillText("♠   ♥   ♦   ♣", width - 84, 108);
  ctx.fillStyle = "#F7F2E8";
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`Saison ${dataset.schoolYear}`, width - 84, 150);

  // Section Podium de la soiree (3 cartes en haut)
  ctx.textAlign = "left";
  const podiumY = 212;
  const podiumW = 748;
  const podiumH = 190;
  const podiumGap = 30;

  const podiumCards = [
    {
      badge: "VAINQUEUR DU TOURNOI · FINALE 1000 PTS",
      team: dataset.eveningStats.podium.winner.teamName,
      binome: dataset.eveningStats.podium.winner.binome,
      meta: `Tête de série #${dataset.eveningStats.podium.winner.seed}  ·  Victoire ${dataset.eveningStats.podium.winner.finalScore}`,
      points: `${dataset.eveningStats.podium.winner.totalEveningPoints} pts cumulés`,
      borderColor: "#E8A628",
      badgeColor: "#E8A628",
    },
    {
      badge: "FINALISTE · 2e PLACE",
      team: dataset.eveningStats.podium.finalist.teamName,
      binome: dataset.eveningStats.podium.finalist.binome,
      meta: `Tête de série #${dataset.eveningStats.podium.finalist.seed}  ·  Finale ${dataset.eveningStats.podium.finalist.finalScore}`,
      points: `${dataset.eveningStats.podium.finalist.totalEveningPoints} pts cumulés`,
      borderColor: "#A64622",
      badgeColor: "#CBBEB0",
    },
    {
      badge: "DEMI-FINALISTES (700 PTS) & POULE OFFENSIVE",
      team: `${dataset.eveningStats.podium.semifinalists[0]?.teamName ?? "Les Atouts d'Or"} / ${dataset.eveningStats.podium.semifinalists[1]?.teamName ?? "Capot Eirb"}`,
      binome: `Poule la plus forte : ${dataset.eveningStats.mostOffensivePoolLabel} (${dataset.eveningStats.mostOffensivePoolPoints} pts)`,
      meta: `Record poules : ${dataset.eveningStats.highestPoolTeamName} (${dataset.eveningStats.highestPoolTeamPoints} pts)`,
      points: `${dataset.eveningStats.capotsPassed} Capots · ${dataset.eveningStats.generalesPassed} Générales · ${dataset.eveningStats.coinchesPassed} Coinches`,
      borderColor: "#2D7D4E",
      badgeColor: "#389960",
    },
  ];

  for (let i = 0; i < podiumCards.length; i += 1) {
    const card = podiumCards[i];
    if (card === undefined) {
      continue;
    }
    const x = 48 + i * (podiumW + podiumGap);
    drawRoundedRect(ctx, x, podiumY, podiumW, podiumH, 16);
    ctx.fillStyle = "#221B17";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = card.borderColor;
    ctx.stroke();

    ctx.fillStyle = card.badgeColor;
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(card.badge, x + 24, podiumY + 36);

    ctx.fillStyle = "#F7F2E8";
    ctx.font = '800 38px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.fillText(card.team, x + 24, podiumY + 84);

    ctx.fillStyle = "#CBBEB0";
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(card.binome, x + 24, podiumY + 118);

    ctx.fillStyle = "#9A8C7E";
    ctx.font = '500 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(card.meta, x + 24, podiumY + 148);

    ctx.fillStyle = "#E8A628";
    ctx.font = '700 20px "Barlow Condensed", sans-serif';
    ctx.fillText(card.points, x + 24, podiumY + 174);
  }

  // Grille des 5 Poules (A a E) sur une ligne
  const poolStartY = 432;
  const poolCardW = 442;
  const poolCardH = 540;
  const poolGap = 23;

  for (let pIdx = 0; pIdx < dataset.qualification.pools.length; pIdx += 1) {
    const pool = dataset.qualification.pools[pIdx];
    if (pool === undefined) {
      continue;
    }
    const px = 48 + pIdx * (poolCardW + poolGap);

    drawRoundedRect(ctx, px, poolStartY, poolCardW, poolCardH, 16);
    ctx.fillStyle = "#FFFDF8";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#C2B296";
    ctx.stroke();

    // En-tete de la carte poule
    drawRoundedRect(ctx, px, poolStartY, poolCardW, 74, 16);
    ctx.fillStyle = "#221B17";
    ctx.fill();

    ctx.fillStyle = "#E8A628";
    ctx.font = '800 32px "Barlow Condensed", sans-serif';
    ctx.fillText(pool.poolLabel.toUpperCase(), px + 20, poolStartY + 46);

    ctx.textAlign = "right";
    ctx.fillStyle = "#F7F2E8";
    ctx.font = '700 22px "Barlow Condensed", sans-serif';
    ctx.fillText(`Force : ${pool.poolTotalPoints} pts`, px + poolCardW - 20, poolStartY + 45);
    ctx.textAlign = "left";

    // Lignes des 4 equipes de la poule
    for (let rIdx = 0; rIdx < pool.standings.length; rIdx += 1) {
      const team = pool.standings[rIdx];
      if (team === undefined) {
        continue;
      }
      const ry = poolStartY + 92 + rIdx * 108;
      const qual = dataset.qualifiedLookup[team.teamId];

      drawRoundedRect(ctx, px + 14, ry, poolCardW - 28, 96, 10);
      if (qual !== undefined && qual.qualified) {
        if (qual.qualificationReason === "best_wildcards") {
          ctx.fillStyle = "#FBF0D5";
          ctx.strokeStyle = "#E8A628";
        } else {
          ctx.fillStyle = "#F7F2E8";
          ctx.strokeStyle = "#DFD4C0";
        }
      } else {
        ctx.fillStyle = "#FBE8E6";
        ctx.strokeStyle = "#C8342B";
      }
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Rang + Nom equipe
      ctx.fillStyle = "#1C1612";
      ctx.font = '800 26px "Barlow Condensed", sans-serif';
      ctx.fillText(`${team.poolRank}. ${team.teamName}`, px + 26, ry + 34);

      // Score goal average a droite
      ctx.textAlign = "right";
      ctx.fillStyle = "#1C1612";
      ctx.font = '800 28px "Barlow Condensed", sans-serif';
      ctx.fillText(`${team.pointsScored} pts`, px + poolCardW - 26, ry + 34);
      ctx.textAlign = "left";

      // Binome + bilan V/D
      const binome = resolveBinomeText(team.teamId, dataset.teamMetaById);
      ctx.fillStyle = "#594D43";
      ctx.font = '600 17px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${binome}`, px + 26, ry + 60);

      // Statut qualification
      let statusLabel = "ÉLIMINÉ";
      let statusColor = "#C8342B";
      if (qual !== undefined && qual.qualified) {
        if (qual.qualificationReason === "best_wildcards") {
          statusLabel = `MEILLEUR 4e QUALIFIÉ (#${qual.bracketSeed ?? 16})`;
          statusColor = "#A64622";
        } else {
          statusLabel = `QUALIFIÉ TOP 3 (#${qual.bracketSeed ?? 1})`;
          statusColor = "#2D7D4E";
        }
      }

      ctx.fillStyle = statusColor;
      ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
      let diffPrefix = "";
      if (team.pointsDiff > 0) {
        diffPrefix = "+";
      }
      ctx.fillText(
        `${team.matchesWon}V–${team.matchesLost}D (${diffPrefix}${team.pointsDiff}) · ${statusLabel}`,
        px + 26,
        ry + 84,
      );
    }
  }

  // Bandeau inferieur : Départage des 4es (gauche) + Phases finales & Top Annuel (droite)
  const bottomY = 1002;
  const bottomH = 568;

  // Bloc gauche : Departage des Meilleurs 4es
  drawRoundedRect(ctx, 48, bottomY, 1120, bottomH, 16);
  ctx.fillStyle = "#221B17";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#524339";
  ctx.stroke();

  ctx.fillStyle = "#E8A628";
  ctx.font = '800 32px "Barlow Condensed", sans-serif';
  ctx.fillText(
    "DÉPARTAGE OFFICIEL DES MEILLEURS 4es (1 QUALIFIÉ / 4 ÉLIMINÉS)",
    76,
    bottomY + 48,
  );

  ctx.fillStyle = "#CBBEB0";
  ctx.font = '500 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    "Critères : 1. Victoires · 2. Goal-Average (pts marqués) · 3. Égalité parfaite : Poule la plus forte (total pts poule).",
    76,
    bottomY + 80,
  );

  for (
    let wIdx = 0;
    wIdx < dataset.qualification.wildcardCandidatesRanked.length;
    wIdx += 1
  ) {
    const cand = dataset.qualification.wildcardCandidatesRanked[wIdx];
    if (cand === undefined) {
      continue;
    }
    const wy = bottomY + 106 + wIdx * 86;
    drawRoundedRect(ctx, 76, wy, 1064, 72, 10);

    if (cand.qualified) {
      ctx.fillStyle = "#3A2D15";
      ctx.strokeStyle = "#E8A628";
    } else {
      ctx.fillStyle = "#2B231E";
      ctx.strokeStyle = "#382E27";
    }
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#F7F2E8";
    ctx.font = '800 28px "Barlow Condensed", sans-serif';
    ctx.fillText(
      `#${wIdx + 1} des 4es · ${cand.teamName} (${cand.poolLabel})`,
      98,
      wy + 45,
    );

    ctx.fillStyle = "#CBBEB0";
    ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      `${cand.matchesWon}V · ${cand.pointsScored} pts marqués · Poule : ${cand.poolTotalPoints} pts`,
      540,
      wy + 44,
    );

    ctx.textAlign = "right";
    if (cand.qualified) {
      ctx.fillStyle = "#E8A628";
      ctx.font = '800 24px "Barlow Condensed", sans-serif';
      ctx.fillText("QUALIFIÉ #16", 1116, wy + 45);
    } else {
      ctx.fillStyle = "#DC463D";
      ctx.font = '700 22px "Barlow Condensed", sans-serif';
      ctx.fillText("ÉLIMINÉ", 1116, wy + 45);
    }
    ctx.textAlign = "left";
  }

  // Bloc droit : Resultats Phases Finales (Quarts, Demies, Finale)
  drawRoundedRect(ctx, 1196, bottomY, 1156, bottomH, 16);
  ctx.fillStyle = "#221B17";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#524339";
  ctx.stroke();

  ctx.fillStyle = "#E8A628";
  ctx.font = '800 32px "Barlow Condensed", sans-serif';
  ctx.fillText(
    "TABLEAU FINAL (QUARTS 600 · DEMIES 700 · FINALE 1000 PTS)",
    1224,
    bottomY + 48,
  );

  const keyKnockout = dataset.knockoutMatches.filter(
    (m) => m.phase !== "round_of_16",
  );

  for (let kIdx = 0; kIdx < keyKnockout.length; kIdx += 1) {
    const km = keyKnockout[kIdx];
    if (km === undefined) {
      continue;
    }
    const ky = bottomY + 74 + kIdx * 68;
    drawRoundedRect(ctx, 1224, ky, 1100, 56, 8);
    if (km.phase === "final") {
      ctx.fillStyle = "#3A2D15";
      ctx.strokeStyle = "#E8A628";
    } else {
      ctx.fillStyle = "#2B231E";
      ctx.strokeStyle = "#382E27";
    }
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#E8A628";
    ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(formatPhaseLabel(km.phase).toUpperCase(), 1242, ky + 35);

    ctx.fillStyle = "#F7F2E8";
    ctx.font = '800 25px "Barlow Condensed", sans-serif';
    ctx.fillText(
      `#${km.seedA} ${km.teamAName}   ${km.scoreTeamA} – ${km.scoreTeamB}   #${km.seedB} ${km.teamBName}`,
      1610,
      ky + 36,
    );
  }

  // Pied de page
  ctx.fillStyle = "#9A8C7E";
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    "Coinch'Eirb · ENSEIRB-MATMECA Bordeaux INP · Règlement officiel Tout Atout / Sans Atout sans annonces · Généré localement",
    48,
    height - 32,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((generated) => {
      resolve(generated);
    }, "image/png");
  });

  if (blob === null) {
    return {
      ok: false,
      format: "PNG",
      filename: "",
      message: "La conversion de la planche Canvas en image PNG a échoué.",
    };
  }

  const filename = "coincheirb-planche-resultats-hd.png";
  triggerBlobDownload(blob, filename);

  return {
    ok: true,
    format: "PNG",
    filename,
    message: `Planche PNG Haute Définition 2400×1660 px (${filename}) téléchargée avec succès.`,
  };
}

/**
 * Convertit une chaine UTF-8 en texte compatible WinAnsi / Latin-1 pour un flux PDF 1.4 natif,
 * en remplacant les caracteres speciaux hors plage par leurs equivalents lisibles.
 */
function sanitizePdfText(input: string): string {
  return input
    .replace(/·/g, "-")
    .replace(/–/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/×/g, "x")
    .replace(/œ/g, "oe")
    .replace(/Œ/g, "OE")
    .replace(/’/g, "'")
    .replace(/[♠♥♦♣]/g, "*");
}

function encodeWinAnsiHex(input: string): string {
  const clean = sanitizePdfText(input);
  let hex = "";
  for (let i = 0; i < clean.length; i += 1) {
    const code = clean.charCodeAt(i);
    let byte = 32;
    if (code >= 32 && code <= 255) {
      byte = code;
    }
    const part = byte.toString(16).toUpperCase();
    if (part.length === 1) {
      hex += `0${part}`;
    } else {
      hex += part;
    }
  }
  return `<${hex}>`;
}

interface PdfPageBuilder {
  commands: string[];
}

/**
 * Construit un fichier binaire `.pdf` multi-pages 100 % autonome (norme PDF 1.4 avec table xref exacte),
 * sans aucune librairie externe ni popup bloquee par le navigateur.
 */
function buildStandalonePdfBytes(pages: PdfPageBuilder[]): Uint8Array {
  const objects: string[] = [];

  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  // 1: Catalog, 2: Pages, 3: Font Helvetica, 4: Font Helvetica-Bold
  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("<< /Type /Pages /Kids [] /Count 0 >>");
  addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageObjectIds: number[] = [];

  for (const page of pages) {
    const streamBody = page.commands.join("\n");
    const contentId = addObject(
      `<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageObjectIds.push(pageId);
  }

  const kidsRefs = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects[1] = `<< /Type /Pages /Kids [${kidsRefs}] /Count ${pageObjectIds.length} >>`;

  let pdfText = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdfText.length);
    const objNum = i + 1;
    pdfText += `${objNum} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdfText.length;
  pdfText += `xref\n0 ${objects.length + 1}\n`;
  pdfText += "0000000000 65535 f \n";

  for (let i = 1; i < offsets.length; i += 1) {
    const off = offsets[i] ?? 0;
    const padded = String(off).padStart(10, "0");
    pdfText += `${padded} 00000 n \n`;
  }

  pdfText += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdfText.length);
  for (let i = 0; i < pdfText.length; i += 1) {
    bytes[i] = pdfText.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * 3. Export PDF officiel (`exportTournamentPdf`) :
 * Genere et telecharge directement un rapport `.pdf` A4 multi-pages (Podium, Poules A-E,
 * Departage des Meilleurs 4es, Arbre des Phases Finales et Classement Annuel).
 */
export function exportTournamentPdf(
  dataset: ClassementFullDataset,
): ExportResultFeedback {
  const createPage = (subtitle: string, pageNum: number, totalPages: number): {
    builder: PdfPageBuilder;
    drawText: (
      text: string,
      x: number,
      y: number,
      size?: number,
      bold?: boolean,
      rgb?: [number, number, number],
    ) => void;
    drawRect: (
      x: number,
      y: number,
      w: number,
      h: number,
      rgb: [number, number, number],
    ) => void;
  } => {
    const builder: PdfPageBuilder = { commands: [] };

    const drawRect = (
      x: number,
      y: number,
      w: number,
      h: number,
      rgb: [number, number, number],
    ) => {
      builder.commands.push(
        `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg ${x} ${y} ${w} ${h} re f`,
      );
    };

    const drawText = (
      text: string,
      x: number,
      y: number,
      size: number = 10,
      bold: boolean = false,
      rgb: [number, number, number] = [0.11, 0.086, 0.071],
    ) => {
      let fontKey = "/F1";
      if (bold) {
        fontKey = "/F2";
      }
      const hex = encodeWinAnsiHex(text);
      builder.commands.push(
        `BT ${fontKey} ${size} Tf ${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} rg 1 0 0 1 ${x} ${y} Tm ${hex} Tj ET`,
      );
    };

    // Fond clair papier cartonne (#F7F2E8)
    drawRect(0, 0, 595, 842, [0.969, 0.949, 0.91]);
    // Bandeau en-tete sombre (#161210) + filet ambre (#E8A628)
    drawRect(0, 768, 595, 74, [0.086, 0.071, 0.063]);
    drawRect(0, 764, 595, 4, [0.91, 0.651, 0.157]);

    drawText(
      "COINCH'EIRB - RAPPORT OFFICIEL DU TOURNOI (ENSEIRB-MATMECA)",
      36,
      814,
      10,
      true,
      [0.91, 0.651, 0.157],
    );
    drawText(
      `${dataset.tournamentTitle} - ${subtitle}`,
      36,
      792,
      15,
      true,
      [0.969, 0.949, 0.91],
    );
    drawText(
      `${dataset.eventDateLabel} | Saison ${dataset.schoolYear}`,
      36,
      775,
      9,
      false,
      [0.796, 0.745, 0.69],
    );

    // Pied de page
    drawRect(36, 38, 523, 1, [0.76, 0.698, 0.588]);
    drawText(
      `Association Coinch'Eirb - ENSEIRB-MATMECA | Page ${pageNum}/${totalPages}`,
      36,
      24,
      8.5,
      false,
      [0.35, 0.3, 0.26],
    );

    return { builder, drawText, drawRect };
  };

  // Page 1 : Podium, Statistiques de la soiree & Classement des Poules A-E
  const p1 = createPage("Podium & Classement des Poules (A-E)", 1, 2);
  let y = 738;

  p1.drawText("1. PODIUM DE LA SOIREE & DISTINCTIONS", 36, y, 12, true, [0.651, 0.275, 0.133]);
  y -= 18;

  p1.drawRect(36, y - 54, 523, 62, [1, 0.992, 0.973]);
  p1.drawText(
    `Vainqueur (1000 pts) : ${dataset.eveningStats.podium.winner.teamName} (${dataset.eveningStats.podium.winner.binome}) - Finale ${dataset.eveningStats.podium.winner.finalScore}`,
    46,
    y - 12,
    10,
    true,
  );
  p1.drawText(
    `Finaliste : ${dataset.eveningStats.podium.finalist.teamName} (${dataset.eveningStats.podium.finalist.binome}) | Demi-finalistes : ${dataset.eveningStats.podium.semifinalists[0]?.teamName ?? ""} & ${dataset.eveningStats.podium.semifinalists[1]?.teamName ?? ""}`,
    46,
    y - 28,
    9.5,
    false,
  );
  p1.drawText(
    `Poule la plus offensive : ${dataset.eveningStats.mostOffensivePoolLabel} (${dataset.eveningStats.mostOffensivePoolPoints} pts) | Capots : ${dataset.eveningStats.capotsPassed}/${dataset.eveningStats.capotsAnnounced} | Generales : ${dataset.eveningStats.generalesPassed}/${dataset.eveningStats.generalesAnnounced} | Coinches : ${dataset.eveningStats.coinchesPassed}`,
    46,
    y - 44,
    9,
    false,
    [0.35, 0.3, 0.26],
  );
  y -= 76;

  p1.drawText(
    "2. CLASSEMENT FINAL DES 5 POULES (15 QUALIFIES TOP 3 + 1 MEILLEUR 4e = 16 QUALIFIES)",
    36,
    y,
    12,
    true,
    [0.651, 0.275, 0.133],
  );
  y -= 16;

  for (const pool of dataset.qualification.pools) {
    p1.drawRect(36, y - 14, 523, 18, [0.133, 0.106, 0.09]);
    p1.drawText(
      `${pool.poolLabel.toUpperCase()}  -  TOTAL DES POINTS DE LA POULE (FORCE DE DEPARTAGE) : ${pool.poolTotalPoints} PTS`,
      44,
      y - 9,
      9.5,
      true,
      [0.91, 0.651, 0.157],
    );
    y -= 28;

    for (const row of pool.standings) {
      const qual = dataset.qualifiedLookup[row.teamId];
      const binome = resolveBinomeText(row.teamId, dataset.teamMetaById);
      let status = "Elimine";
      if (qual !== undefined && qual.qualified) {
        if (qual.qualificationReason === "best_wildcards") {
          status = `Meilleur 4e qualifie (#${qual.bracketSeed ?? 16})`;
        } else {
          status = `Qualifie Top 3 (#${qual.bracketSeed ?? 1})`;
        }
      }

      let diffSign = "";
      if (row.pointsDiff > 0) {
        diffSign = "+";
      }

      p1.drawText(
        `${row.poolRank}. ${row.teamName} (${binome})`,
        44,
        y,
        9.5,
        true,
      );
      p1.drawText(
        `${row.matchesWon}V-${row.matchesLost}D | ${row.pointsScored} pts marques (${diffSign}${row.pointsDiff}) | ${status}`,
        275,
        y,
        9,
        false,
      );
      y -= 14;
    }
    y -= 8;
  }

  p1.drawText(
    "3. TABLEAU DE DEPARTAGE DES MEILLEURS 4es (SANS MINI-CONSOLANTE)",
    36,
    y - 4,
    11,
    true,
    [0.651, 0.275, 0.133],
  );
  y -= 20;

  for (let i = 0; i < dataset.qualification.wildcardCandidatesRanked.length; i += 1) {
    const cand = dataset.qualification.wildcardCandidatesRanked[i];
    if (cand === undefined) {
      continue;
    }
    let verdict = "ELIMINE";
    if (cand.qualified) {
      verdict = `QUALIFIE 16e (Tete de serie #${cand.bracketSeed ?? 16})`;
    }
    p1.drawText(
      `Rang 4e #${i + 1} : ${cand.teamName} (${cand.poolLabel}) - ${cand.matchesWon}V | Goal-Average : ${cand.pointsScored} pts | Force poule : ${cand.poolTotalPoints} pts -> ${verdict}`,
      44,
      y,
      9,
      cand.qualified,
    );
    y -= 13;
  }

  // Page 2 : Arbre des Phases Finales & Classement General Annuel
  const p2 = createPage("Arbre des Phases Finales & Classement Annuel", 2, 2);
  let y2 = 738;

  p2.drawText(
    "4. RESULTATS DE L'ARBRE DES PHASES FINALES (8es 500 | QUARTS 600 | DEMIES 700 | FINALE 1000)",
    36,
    y2,
    11.5,
    true,
    [0.651, 0.275, 0.133],
  );
  y2 -= 18;

  for (const match of dataset.knockoutMatches) {
    let highlight = "";
    if (match.highlightNote !== null) {
      highlight = ` [${match.highlightNote}]`;
    }
    p2.drawText(
      `${formatPhaseLabel(match.phase)} - Table ${match.tableNumber} : #${match.seedA} ${match.teamAName} (${match.scoreTeamA}) vs (${match.scoreTeamB}) #${match.seedB} ${match.teamBName}${highlight}`,
      42,
      y2,
      8.8,
      match.phase === "final",
    );
    y2 -= 14;
  }

  y2 -= 12;
  p2.drawText(
    "5. CLASSEMENT GENERAL ANNUEL COINCH'EIRB (SAISON 2026-2027)",
    36,
    y2,
    11.5,
    true,
    [0.651, 0.275, 0.133],
  );
  y2 -= 18;

  p2.drawRect(36, y2 - 12, 523, 18, [0.133, 0.106, 0.09]);
  p2.drawText(
    "RANG  JOUEUR (PROMOTION)             PTS ANNUELS   TOURNOIS   VICTOIRES   TOTAL PTS   CAPOTS / GEN. / COINCHES",
    42,
    y2 - 7,
    8.5,
    true,
    [0.91, 0.651, 0.157],
  );
  y2 -= 26;

  const annual2627: AnnualPlayerStanding[] = dataset.annualPlayers.filter(
    (p) => p.schoolYear === "2026-2027",
  );

  for (const player of annual2627) {
    p2.drawText(
      `#${player.rank}   ${player.displayName} (${player.promotionYear} - ${player.department})`,
      42,
      y2,
      9,
      player.rank <= 3,
    );
    p2.drawText(
      `${player.rankingPoints} pts   |   ${player.tournamentsPlayed} joues (${player.tournamentsWon} titres)   |   ${player.matchesWon}/${player.matchesPlayed} V   |   ${player.totalPointsScored} pts   |   ${player.capotsPassed}C / ${player.generalesPassed}G / ${player.coinchesPassed}Co`,
      230,
      y2,
      8.5,
      false,
    );
    y2 -= 15;
  }

  const pdfBytes = buildStandalonePdfBytes([p1.builder, p2.builder]);
  const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(pdfBytes);
  const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
  const filename = "coincheirb-rapport-officiel-2026-2027.pdf";
  triggerBlobDownload(blob, filename);

  return {
    ok: true,
    format: "PDF",
    filename,
    message: `Rapport PDF officiel A4 2 pages (${filename}) généré et téléchargé.`,
  };
}
