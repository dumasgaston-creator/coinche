"use client";

export interface InstagramStoryPayload {
  tournamentTitle: string;
  winnerNames: string;
  winnerPhotoUrl: string;
  winnerScoreLabel: string;
  finalistNames: string;
  totalDeals: number;
  capotsPassed: number;
  generalesPassed: number;
  coinchesPassed: number;
  topPoolTeamName: string;
  topPoolTeamPoints: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawImageContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): void {
  const ratio = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
  const drawW = Math.round(img.naturalWidth * ratio);
  const drawH = Math.round(img.naturalHeight * ratio);
  const drawX = Math.round(boxX + (boxW - drawW) / 2);
  const drawY = Math.round(boxY + (boxH - drawH) / 2);
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

/**
 * Genere une Story Instagram PNG (1080x1920) prete a publier pour le compte du club Coinch'Eirb :
 * - Logo abeilles + identite serigraphiee ENSEIRB-MATMECA · AU BAR
 * - Photo des vainqueurs affichee 100 % non rognee (`contain`)
 * - Score final et compteurs Capots / Generales / Coinches de la soiree.
 */
export async function downloadInstagramStoryPng(
  payload: InstagramStoryPayload,
): Promise<{ fileName: string }> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("Canvas 2D indisponible.");
  }

  // Fond sombre chaud + cadre d'imprimerie ambre
  ctx.fillStyle = "#14100e";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#e8a628";
  ctx.lineWidth = 6;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  // Bandeau haut
  const logoImg = await loadImageElement("/assets/media/logo-abeilles.jpg");
  if (logoImg !== null) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 145, 56, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logoImg, 74, 89, 112, 112);
    ctx.restore();
    ctx.strokeStyle = "#e8a628";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(130, 145, 56, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#e8a628";
  ctx.font = "800 28px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("ENSEIRB-MATMECA · AU BAR", 214, 130);

  ctx.fillStyle = "#f6efe2";
  ctx.font = "800 66px 'Barlow Condensed', sans-serif";
  ctx.fillText("COINCH'EIRB", 214, 195);

  // Titre soiree
  ctx.fillStyle = "#cbbeb0";
  ctx.font = "700 32px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(payload.tournamentTitle.slice(0, 42), 78, 285);

  // Cadre photo vainqueur 100 % non rognee
  const photoX = 78;
  const photoY = 330;
  const photoW = W - 156;
  const photoH = 740;
  ctx.fillStyle = "#0c0908";
  ctx.fillRect(photoX, photoY, photoW, photoH);
  ctx.strokeStyle = "#e8a628";
  ctx.lineWidth = 4;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  const winnerImg = await loadImageElement(payload.winnerPhotoUrl);
  if (winnerImg !== null) {
    drawImageContained(
      ctx,
      winnerImg,
      photoX + 12,
      photoY + 12,
      photoW - 24,
      photoH - 24,
    );
  }

  // Bloc Vainqueurs
  ctx.fillStyle = "#e8a628";
  ctx.fillRect(78, 1110, 290, 48);
  ctx.fillStyle = "#14100e";
  ctx.font = "800 28px 'Barlow Condensed', sans-serif";
  ctx.fillText("CHAMPIONS DU SOIR", 96, 1144);

  ctx.fillStyle = "#f6efe2";
  ctx.font = "800 84px 'Barlow Condensed', sans-serif";
  ctx.fillText(payload.winnerNames.toUpperCase().slice(0, 26), 78, 1245);

  ctx.fillStyle = "#e8a628";
  ctx.font = "800 48px 'Barlow Condensed', sans-serif";
  ctx.fillText(
    `FINALE : ${payload.winnerScoreLabel}  ·  VS ${payload.finalistNames.slice(0, 22).toUpperCase()}`,
    78,
    1315,
  );

  // Filet separateur
  ctx.strokeStyle = "rgba(232, 166, 40, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(78, 1365);
  ctx.lineTo(W - 78, 1365);
  ctx.stroke();

  // 3 stats cles de la soiree
  const stats: ReadonlyArray<{ label: string; value: string }> = [
    { label: "DONNES JOUÉES", value: String(payload.totalDeals) },
    {
      label: "CAPOTS · GÉNÉRALES",
      value: `${payload.capotsPassed}C · ${payload.generalesPassed}G`,
    },
    { label: "COINCHES PASSÉES", value: String(payload.coinchesPassed) },
  ];

  const colW = Math.floor((W - 156 - 40) / 3);
  for (let i = 0; i < stats.length; i += 1) {
    const stat = stats[i];
    if (stat === undefined) {
      continue;
    }
    const bx = 78 + i * (colW + 20);
    const by = 1410;
    ctx.fillStyle = "#1e1815";
    ctx.fillRect(bx, by, colW, 185);
    ctx.strokeStyle = "#5a4a3f";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, colW, 185);

    ctx.fillStyle = "#cbbeb0";
    ctx.font = "700 22px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(stat.label, bx + 20, by + 54);

    ctx.fillStyle = "#e8a628";
    ctx.font = "800 68px 'Barlow Condensed', sans-serif";
    ctx.fillText(stat.value, bx + 20, by + 145);
  }

  // Meilleur score poules
  ctx.fillStyle = "#183022";
  ctx.fillRect(78, 1630, W - 156, 118);
  ctx.strokeStyle = "#2c523b";
  ctx.lineWidth = 2;
  ctx.strokeRect(78, 1630, W - 156, 118);

  ctx.fillStyle = "#e8a628";
  ctx.font = "700 24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("MEILLEURE ATTAQUE EN POULES", 104, 1676);

  ctx.fillStyle = "#f6efe2";
  ctx.font = "800 44px 'Barlow Condensed', sans-serif";
  ctx.fillText(
    `${payload.topPoolTeamName.toUpperCase()}  ·  ${payload.topPoolTeamPoints} PTS`,
    104,
    1728,
  );

  // Pied de page
  ctx.fillStyle = "#988a7c";
  ctx.font = "700 24px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("@COINCHEIRB · ENSEIRB-MATMECA BORDEAUX", 78, 1835);

  const fileName = `coincheirb-story-${new Date().toISOString().slice(0, 10)}.png`;
  const dataUrl = canvas.toDataURL("image/png");
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  return { fileName };
}
