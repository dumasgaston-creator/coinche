"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  buildClassementDataset,
  type AnnualPlayerStanding,
  type ClassementFullDataset,
  type EveningStatsSummary,
  type KnockoutMatchView,
  type TeamBinomeMeta,
} from "@/components/classement/tournament-data";
import {
  exportStandingsPng,
  exportTournamentCsv,
  exportTournamentPdf,
  type CsvExportScope,
  type ExportResultFeedback,
} from "@/lib/export/exporters";
import {
  findUnifiedTeam,
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
  type DerivedTournamentSummary,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store";
import { useTournamentStore } from "@/lib/tournament/use-tournament-store";
import {
  CheckIcon,
  ClubSuitIcon,
  DiamondSuitIcon,
  HeartSuitIcon,
  LockIcon,
  SpadeSuitIcon,
  TableCardsIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons/Icons";

type ClassementTabKey = "pools" | "knockout" | "annual" | "stats";

function formatSignedDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

function getPhaseDisplayTitle(phase: KnockoutMatchView["phase"]): string {
  if (phase === "round_of_16") {
    return "Huitièmes de finale · 500 pts";
  }
  if (phase === "quarterfinals") {
    return "Quarts de finale · 600 pts";
  }
  if (phase === "semifinals") {
    return "Demi-finales · 700 pts";
  }
  return "Finale · 1000 pts";
}

function normalizeTargetScore(raw: number): 500 | 600 | 700 | 1000 {
  if (raw === 600 || raw === 700 || raw === 1000) {
    return raw;
  }
  return 500;
}

function groupKoMatchesIntoPairs(
  matches: KnockoutMatchView[],
): KnockoutMatchView[][] {
  const pairs: KnockoutMatchView[][] = [];
  for (let i = 0; i < matches.length; i += 2) {
    const first = matches[i];
    const second = matches[i + 1];
    if (first !== undefined && second !== undefined) {
      pairs.push([first, second]);
    } else if (first !== undefined) {
      pairs.push([first]);
    }
  }
  return pairs;
}

const CL_BRACKET_COLUMNS: ReadonlyArray<{
  phase: KnockoutMatchView["phase"];
  label: string;
  targetLabel: string;
}> = [
  { phase: "round_of_16", label: "Huitièmes", targetLabel: "500 pts" },
  { phase: "quarterfinals", label: "Quarts", targetLabel: "600 pts" },
  { phase: "semifinals", label: "Demi-finales", targetLabel: "700 pts" },
  { phase: "final", label: "Grande Finale", targetLabel: "1000 pts" },
];

function buildLiveClassementDatasetNoTernary(
  state: UnifiedTournamentState,
  summary: DerivedTournamentSummary,
  staticFallback: ClassementFullDataset,
): ClassementFullDataset {
  if (summary.qualification === null) {
    return {
      ...staticFallback,
      tournamentTitle: state.tournament.title,
      eventDateLabel: state.tournament.eventDateLabel,
      schoolYear: state.tournament.schoolYear,
    };
  }

  const teamMetaById: Record<string, TeamBinomeMeta> = {};
  for (const team of state.teams) {
    let assignedTable = 1;
    const pool = state.pools.find((p) =>
      p.teams.some((pt) => pt.teamId === team.id),
    );
    if (pool !== undefined) {
      assignedTable = pool.assignedTableStart;
    }
    teamMetaById[team.id] = {
      teamId: team.id,
      teamName: team.teamName,
      player1Name: team.player1Name,
      player2Name: team.player2Name,
      promotionLabel: team.promotionLabel,
      tableNumber: assignedTable,
    };
  }

  const koViews: KnockoutMatchView[] = summary.knockoutMatches.map((km) => {
    let viewStatus: "completed" | "in_progress" | "pending" = "pending";
    if (
      km.status === "completed" ||
      km.status === "forfeit" ||
      km.status === "bye"
    ) {
      viewStatus = "completed";
    } else if (km.status === "in_progress") {
      viewStatus = "in_progress";
    }

    return {
      id: km.id,
      phase: km.phase,
      slot: km.slot,
      tableNumber: km.tableNumber ?? km.slot,
      targetScore: normalizeTargetScore(km.targetScore),
      seedA: km.seedA ?? 1,
      seedB: km.seedB ?? 16,
      teamAId: km.teamAId ?? "pending-a",
      teamAName: km.teamAPlayers,
      teamABinome: km.teamANickname ?? "",
      teamBId: km.teamBId ?? "pending-b",
      teamBName: km.teamBPlayers,
      teamBBinome: km.teamBNickname ?? "",
      scoreTeamA: km.scoreTeamA,
      scoreTeamB: km.scoreTeamB,
      status: viewStatus,
      winnerTeamId: km.winnerTeamId,
      highlightNote: km.highlightNote,
    };
  });

  const finalMatch = koViews.find((m) => m.phase === "final");
  const semiMatches = koViews.filter((m) => m.phase === "semifinals");
  const seed1 = summary.qualification.qualifiedTeams[0];
  const seed2 = summary.qualification.qualifiedTeams[1];
  const seed3 = summary.qualification.qualifiedTeams[2];
  const seed4 = summary.qualification.qualifiedTeams[3];

  let winnerName = seed1?.teamName ?? "Tête de série #1 (en course)";
  let winnerBinome = "";
  let winnerSeed = seed1?.bracketSeed ?? 1;
  let winnerScoreLabel = "En course";
  let winnerTotalPts = seed1?.pointsScored ?? 0;

  let finalistName = seed2?.teamName ?? "Tête de série #2 (en course)";
  let finalistBinome = "";
  let finalistSeed = seed2?.bracketSeed ?? 2;
  let finalistScoreLabel = "En course";
  let finalistTotalPts = seed2?.pointsScored ?? 0;

  if (seed1 !== undefined) {
    const t1 = findUnifiedTeam(state.teams, seed1.teamId);
    if (t1 !== null) {
      winnerName = formatPlayersPrimaryName(t1.player1Name, t1.player2Name);
      winnerBinome =
        formatOptionalTeamNickname(t1.teamName, t1.player1Name, t1.player2Name) ??
        "Leader des poules";
    }
  }
  if (seed2 !== undefined) {
    const t2 = findUnifiedTeam(state.teams, seed2.teamId);
    if (t2 !== null) {
      finalistName = formatPlayersPrimaryName(t2.player1Name, t2.player2Name);
      finalistBinome =
        formatOptionalTeamNickname(t2.teamName, t2.player1Name, t2.player2Name) ??
        "2e tête de série";
    }
  }

  if (
    finalMatch !== undefined &&
    finalMatch.status === "completed" &&
    finalMatch.winnerTeamId !== null &&
    !finalMatch.id.startsWith("proj-")
  ) {
    if (finalMatch.winnerTeamId === finalMatch.teamAId) {
      winnerName = finalMatch.teamAName;
      winnerBinome = finalMatch.teamABinome;
      winnerSeed = finalMatch.seedA;
      winnerScoreLabel = `${finalMatch.scoreTeamA} – ${finalMatch.scoreTeamB}`;
      finalistName = finalMatch.teamBName;
      finalistBinome = finalMatch.teamBBinome;
      finalistSeed = finalMatch.seedB;
      finalistScoreLabel = `${finalMatch.scoreTeamB} – ${finalMatch.scoreTeamA}`;
    } else {
      winnerName = finalMatch.teamBName;
      winnerBinome = finalMatch.teamBBinome;
      winnerSeed = finalMatch.seedB;
      winnerScoreLabel = `${finalMatch.scoreTeamB} – ${finalMatch.scoreTeamA}`;
      finalistName = finalMatch.teamAName;
      finalistBinome = finalMatch.teamABinome;
      finalistSeed = finalMatch.seedA;
      finalistScoreLabel = `${finalMatch.scoreTeamA} – ${finalMatch.scoreTeamB}`;
    }

    winnerTotalPts = state.matches
      .filter(
        (m) =>
          m.teamAId === finalMatch.winnerTeamId ||
          m.teamBId === finalMatch.winnerTeamId,
      )
      .reduce((acc, m) => {
        if (m.teamAId === finalMatch.winnerTeamId) {
          return acc + m.scoreTeamA;
        }
        return acc + m.scoreTeamB;
      }, 0);
  }

  const semifinalists: EveningStatsSummary["podium"]["semifinalists"] = [];
  if (
    semiMatches.length > 0 &&
    semiMatches.every(
      (s) => s.status === "completed" && !s.id.startsWith("proj-"),
    )
  ) {
    for (const sm of semiMatches) {
      if (sm.winnerTeamId === sm.teamAId) {
        semifinalists.push({
          teamName: sm.teamBName,
          binome: sm.teamBBinome,
          seed: sm.seedB,
          semiScore: `${sm.scoreTeamB} – ${sm.scoreTeamA}`,
          totalEveningPoints: sm.scoreTeamB,
        });
      } else {
        semifinalists.push({
          teamName: sm.teamAName,
          binome: sm.teamABinome,
          seed: sm.seedA,
          semiScore: `${sm.scoreTeamA} – ${sm.scoreTeamB}`,
          totalEveningPoints: sm.scoreTeamA,
        });
      }
    }
  } else {
    const s3Team = findUnifiedTeam(state.teams, seed3?.teamId);
    let s3Name = seed3?.teamName ?? "Qualifié #3";
    let s3Binome = "En course";
    if (s3Team !== null) {
      s3Name = formatPlayersPrimaryName(s3Team.player1Name, s3Team.player2Name);
      s3Binome =
        formatOptionalTeamNickname(
          s3Team.teamName,
          s3Team.player1Name,
          s3Team.player2Name,
        ) ?? "Poules";
    }
    const s4Team = findUnifiedTeam(state.teams, seed4?.teamId);
    let s4Name = seed4?.teamName ?? "Qualifié #4";
    let s4Binome = "En course";
    if (s4Team !== null) {
      s4Name = formatPlayersPrimaryName(s4Team.player1Name, s4Team.player2Name);
      s4Binome =
        formatOptionalTeamNickname(
          s4Team.teamName,
          s4Team.player1Name,
          s4Team.player2Name,
        ) ?? "Poules";
    }
    semifinalists.push({
      teamName: s3Name,
      binome: s3Binome,
      seed: 3,
      semiScore: `${seed3?.pointsScored ?? 0} pts poule`,
      totalEveningPoints: seed3?.pointsScored ?? 0,
    });
    semifinalists.push({
      teamName: s4Name,
      binome: s4Binome,
      seed: 4,
      semiScore: `${seed4?.pointsScored ?? 0} pts poule`,
      totalEveningPoints: seed4?.pointsScored ?? 0,
    });
  }

  const eveningStats: EveningStatsSummary = {
    tournamentTitle: state.tournament.title,
    eventDateLabel: state.tournament.eventDateLabel,
    schoolYear: state.tournament.schoolYear,
    totalTeams: state.teams.length,
    qualifiedCount: summary.qualification.qualifiedTeams.length,
    eliminatedCount: summary.qualification.eliminatedTeams.length,
    totalDealsPlayed: summary.totalDealsPlayed,
    totalPointsScoredAllMatches: summary.totalPointsAllMatches,
    mostOffensivePoolLabel: summary.mostOffensivePoolLabel,
    mostOffensivePoolPoints: summary.mostOffensivePoolPoints,
    highestPoolTeamName: summary.highestPoolTeamName,
    highestPoolTeamBinome: summary.highestPoolTeamBinome,
    highestPoolTeamPoints: summary.highestPoolTeamPoints,
    capotsAnnounced: summary.capotsAnnounced,
    capotsPassed: summary.capotsPassed,
    generalesAnnounced: summary.generalesAnnounced,
    generalesPassed: summary.generalesPassed,
    coinchesAnnounced: summary.coinchesAnnounced,
    coinchesPassed: summary.coinchesPassed,
    surcoinchesAnnounced: summary.surcoinchesAnnounced,
    surcoinchesPassed: summary.surcoinchesPassed,
    parlantesPenalized: summary.parlantesPenalized,
    podium: {
      winner: {
        teamName: winnerName,
        binome: winnerBinome,
        seed: winnerSeed,
        finalScore: winnerScoreLabel,
        totalEveningPoints: winnerTotalPts,
      },
      finalist: {
        teamName: finalistName,
        binome: finalistBinome,
        seed: finalistSeed,
        finalScore: finalistScoreLabel,
        totalEveningPoints: finalistTotalPts,
      },
      semifinalists,
    },
    distinctions: [
      {
        id: "dist-pool-offense",
        categoryLabel: "Départage officiel inter-poules",
        title: "Poule la plus offensive",
        valueLabel: `${summary.mostOffensivePoolPoints} pts cumulés`,
        recipientName: summary.mostOffensivePoolLabel,
        subLabel:
          "Départage automatiquement toute égalité parfaite au goal-average entre deux équipes de poules différentes.",
        accentTone: "amber",
      },
      {
        id: "dist-top-scorer",
        categoryLabel: "Goal-Average en direct",
        title: "Plus grand total en poules",
        valueLabel: `${summary.highestPoolTeamPoints} pts marqués`,
        recipientName: summary.highestPoolTeamName,
        subLabel: `${summary.highestPoolTeamBinome} · Tête de série #1`,
        accentTone: "pass",
      },
      {
        id: "dist-capots",
        categoryLabel: "Contrats à 250 pts",
        title: "Capots enregistrés",
        valueLabel: `${summary.capotsPassed} passés / ${summary.capotsAnnounced}`,
        recipientName: "250 pts par Capot fait",
        subLabel: "160 pts attribués à la défense en cas de chute",
        accentTone: "amber",
      },
      {
        id: "dist-generales",
        categoryLabel: "Contrats à 500 pts",
        title: "Générales enregistrées",
        valueLabel: `${summary.generalesPassed} passées / ${summary.generalesAnnounced}`,
        recipientName: "500 pts par Générale faite",
        subLabel: "8 plis remportés par un seul joueur",
        accentTone: "terracotta",
      },
      {
        id: "dist-coinches",
        categoryLabel: "Contrats doublés et quadruplés",
        title: "Coinches & Surcoinches",
        valueLabel: `${summary.coinchesPassed} Coinches · ${summary.surcoinchesPassed} Surcoinches`,
        recipientName: `${summary.coinchesAnnounced + summary.surcoinchesAnnounced} annonces contrées`,
        subLabel: "Coinche ×2 · Surcoinche ×4",
        accentTone: "pass",
      },
      {
        id: "dist-parlantes",
        categoryLabel: "Discipline officielle",
        title: "Parlantes sanctionnées",
        valueLabel: `${summary.parlantesPenalized} parlante(s)`,
        recipientName: "160 pts par parlante",
        subLabel: "Règlement Coinch'Eirb sans annonces ni règle partenaire",
        accentTone: "fail",
      },
    ],
  };

  return {
    tournamentTitle: state.tournament.title,
    eventDateLabel: state.tournament.eventDateLabel,
    schoolYear: state.tournament.schoolYear,
    teams: state.teams,
    teamMetaById,
    pools: state.pools,
    poolMatches: [],
    qualification: summary.qualification,
    qualifiedLookup: summary.qualifiedLookup,
    knockoutMatches: koViews,
    annualPlayers: staticFallback.annualPlayers,
    eveningStats,
  };
}

export function ClassementView() {
  const staticFallback = useMemo(() => buildClassementDataset(), []);
  const { state, summary } = useTournamentStore();

  const dataset = useMemo(
    () => buildLiveClassementDatasetNoTernary(state, summary, staticFallback),
    [state, summary, staticFallback],
  );

  const [activeTab, setActiveTab] = useState<ClassementTabKey>("pools");
  const [selectedPoolNumber, setSelectedPoolNumber] = useState<number>(0);
  const [selectedKnockoutPhase, setSelectedKnockoutPhase] =
    useState<KnockoutMatchView["phase"]>("round_of_16");
  const [annualSearch, setAnnualSearch] = useState<string>("");
  const [annualSchoolYear, setAnnualSchoolYear] = useState<string>("2026-2027");
  const [annualPromoFilter, setAnnualPromoFilter] = useState<string>("ALL");

  const [csvScope, setCsvScope] = useState<CsvExportScope>("all");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] =
    useState<ExportResultFeedback | null>(null);

  const visiblePools = useMemo(() => {
    if (selectedPoolNumber === 0) {
      return dataset.qualification.pools;
    }
    return dataset.qualification.pools.filter(
      (p) => p.poolNumber === selectedPoolNumber,
    );
  }, [dataset.qualification.pools, selectedPoolNumber]);

  const visibleKnockoutMatches = useMemo(() => {
    return dataset.knockoutMatches.filter(
      (m) => m.phase === selectedKnockoutPhase,
    );
  }, [dataset.knockoutMatches, selectedKnockoutPhase]);

  const filteredAnnualPlayers = useMemo(() => {
    const query = annualSearch.trim().toLowerCase();
    return dataset.annualPlayers.filter((player: AnnualPlayerStanding) => {
      if (
        annualSchoolYear !== "ALL" &&
        player.schoolYear !== annualSchoolYear
      ) {
        return false;
      }
      if (
        annualPromoFilter !== "ALL" &&
        player.promotionYear !== annualPromoFilter
      ) {
        return false;
      }
      if (query.length > 0) {
        const hay = `${player.displayName} ${player.department} ${player.promotionYear}`.toLowerCase();
        if (!hay.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [
    dataset.annualPlayers,
    annualSearch,
    annualSchoolYear,
    annualPromoFilter,
  ]);

  function handleExportCsv() {
    setIsExporting(true);
    try {
      const result = exportTournamentCsv(dataset, csvScope);
      setExportFeedback(result);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPng() {
    setIsExporting(true);
    try {
      const result = await exportStandingsPng(dataset);
      setExportFeedback(result);
    } finally {
      setIsExporting(false);
    }
  }

  function handleExportPdf() {
    setIsExporting(true);
    try {
      const result = exportTournamentPdf(dataset);
      setExportFeedback(result);
    } finally {
      setIsExporting(false);
    }
  }

  let tabPoolsActive = "false";
  let tabKnockoutActive = "false";
  let tabAnnualActive = "false";
  let tabStatsActive = "false";

  if (activeTab === "pools") {
    tabPoolsActive = "true";
  } else if (activeTab === "knockout") {
    tabKnockoutActive = "true";
  } else if (activeTab === "annual") {
    tabAnnualActive = "true";
  } else {
    tabStatsActive = "true";
  }

  return (
    <div className="classement-shell">
      <header className="classement-hero">
        <div className="classement-hero-top">
          <div className="classement-title-row">
            <div>
              <span className="eyebrow">
                <TrophyIcon size={14} />
                <span>Synchronisé en direct · {dataset.eventDateLabel}</span>
              </span>
              <h1 className="classement-main-title">
                Classements &amp; Arbre Coinch&apos;Eirb
              </h1>
              <p className="classement-subtitle">
                Suivi temps réel des poules, course aux meilleurs 4es, arbre des
                phases finales (500 / 600 / 700 / 1000 pts) et classement
                général annuel. Chaque point saisi sur <strong>Ma table</strong>{" "}
                ou <strong>/admin</strong> met cette page à jour instantanément.
              </p>
            </div>
            <span className="badge badge-amber">
              Saison {dataset.schoolYear}
            </span>
          </div>
        </div>

        <div className="classement-kpi-strip">
          <div className="classement-kpi-box">
            <span className="classement-kpi-label">Qualification</span>
            <span className="classement-kpi-value">
              {dataset.eveningStats.qualifiedCount} /{" "}
              {dataset.eveningStats.totalTeams}
            </span>
            <span className="classement-kpi-sub">
              Top 3 par poule + meilleur(s) 4e
            </span>
          </div>
          <div className="classement-kpi-box">
            <span className="classement-kpi-label">Poule la plus forte</span>
            <span className="classement-kpi-value">
              {dataset.eveningStats.mostOffensivePoolLabel}
            </span>
            <span className="classement-kpi-sub">
              {dataset.eveningStats.mostOffensivePoolPoints} pts cumulés
            </span>
          </div>
          <div className="classement-kpi-box">
            <span className="classement-kpi-label">Tête de série #1</span>
            <span className="classement-kpi-value">
              {dataset.eveningStats.highestPoolTeamPoints} pts
            </span>
            <span className="classement-kpi-sub">
              {dataset.eveningStats.highestPoolTeamName}
            </span>
          </div>
          <div className="classement-kpi-box">
            <span className="classement-kpi-label">Annonces passées</span>
            <span className="classement-kpi-value">
              {dataset.eveningStats.capotsPassed}C ·{" "}
              {dataset.eveningStats.generalesPassed}G
            </span>
            <span className="classement-kpi-sub">
              {dataset.eveningStats.coinchesPassed} Coinches ·{" "}
              {dataset.eveningStats.parlantesPenalized} Parlantes
            </span>
          </div>
        </div>

        <div className="classement-export-bar">
          <div className="classement-export-header">
            <span className="classement-export-title">
              Exports officiels en direct (PNG · PDF · CSV)
            </span>
            <span style={{ fontSize: "12px", color: "var(--ink-secondary)" }}>
              Génération locale instantanée à partir des scores actuels
            </span>
          </div>

          <div className="classement-export-actions">
            <div className="classement-csv-row">
              <select
                aria-label="Périmètre de l'export CSV"
                className="field-input"
                style={{ minHeight: "40px", fontSize: "13px" }}
                value={csvScope}
                onChange={(e) => setCsvScope(e.target.value as CsvExportScope)}
              >
                <option value="all">CSV Complet (Poules + Arbre + Annuel)</option>
                <option value="pools">CSV Poules &amp; Meilleurs 4es</option>
                <option value="knockout">CSV Phases finales (8es à Finale)</option>
                <option value="annual">CSV Classement annuel 2026-2027</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ minHeight: "40px" }}
                disabled={isExporting}
                onClick={handleExportCsv}
              >
                Exporter CSV
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ minHeight: "40px" }}
              disabled={isExporting}
              onClick={handleExportPng}
            >
              Télécharger Planche PNG (2x)
            </button>

            <button
              type="button"
              className="btn btn-terracotta btn-sm"
              style={{ minHeight: "40px" }}
              disabled={isExporting}
              onClick={handleExportPdf}
            >
              Télécharger Rapport PDF (A4)
            </button>
          </div>

          {exportFeedback !== null && (
            <div
              className="banner banner-pass"
              role="status"
              aria-live="polite"
            >
              <CheckIcon size={16} />
              <div>
                <strong>Export {exportFeedback.format} prêt :</strong>{" "}
                {exportFeedback.message}
              </div>
            </div>
          )}
        </div>
      </header>

      <nav
        className="classement-tabs"
        aria-label="Sections du classement Coinch'Eirb"
      >
        <button
          type="button"
          className="classement-tab-btn"
          data-active={tabPoolsActive}
          onClick={() => setActiveTab("pools")}
        >
          <TableCardsIcon size={16} />
          <span>Poules &amp; 4es</span>
        </button>
        <button
          type="button"
          className="classement-tab-btn"
          data-active={tabKnockoutActive}
          onClick={() => setActiveTab("knockout")}
        >
          <SpadeSuitIcon size={15} />
          <span>Arbre Final</span>
        </button>
        <button
          type="button"
          className="classement-tab-btn"
          data-active={tabAnnualActive}
          onClick={() => setActiveTab("annual")}
        >
          <UsersIcon size={16} />
          <span>Annuel 26-27</span>
        </button>
        <button
          type="button"
          className="classement-tab-btn"
          data-active={tabStatsActive}
          onClick={() => setActiveTab("stats")}
        >
          <TrophyIcon size={16} />
          <span>Bilan &amp; Podium</span>
        </button>
      </nav>

      {activeTab === "pools" && (
        <section
          aria-label="Classement des poules et meilleurs quatrièmes"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div
            className="pool-filter-strip"
            role="group"
            aria-label="Filtrer par poule"
          >
            <button
              type="button"
              className="pool-pill-btn"
              data-active={String(selectedPoolNumber === 0)}
              onClick={() => setSelectedPoolNumber(0)}
            >
              Toutes les poules ({dataset.qualification.pools.length})
            </button>
            {dataset.qualification.pools.map((pool) => {
              let isPoolActive = "false";
              if (selectedPoolNumber === pool.poolNumber) {
                isPoolActive = "true";
              }
              return (
                <button
                  key={pool.poolNumber}
                  type="button"
                  className="pool-pill-btn"
                  data-active={isPoolActive}
                  onClick={() => setSelectedPoolNumber(pool.poolNumber)}
                >
                  {pool.poolLabel}
                </button>
              );
            })}
          </div>

          <div className="pools-grid">
            {visiblePools.map((pool) => {
              const firstTable = (pool.poolNumber - 1) * 2 + 1;
              return (
                <article key={pool.poolNumber} className="pool-card">
                  <header className="pool-card-header">
                    <div>
                      <h2 className="pool-card-title">{pool.poolLabel}</h2>
                      <span
                        style={{
                          fontSize: "11.5px",
                          color: "var(--ink-secondary)",
                        }}
                      >
                        Tables {firstTable} &amp; {firstTable + 1} · 5 donnes
                        par match
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span className="badge badge-amber">
                        Force poule : {pool.poolTotalPoints} pts
                      </span>
                      <Link
                        href={`/ma-table?table=${firstTable}`}
                        className="btn btn-sm btn-secondary"
                        style={{ minHeight: "28px", padding: "0 8px" }}
                      >
                        Noter points
                      </Link>
                    </div>
                  </header>

                  <ul className="pool-standings-list">
                    {pool.standings.map((team) => {
                      const qual = dataset.qualifiedLookup[team.teamId];
                      const meta = dataset.teamMetaById[team.teamId];
                      let primaryPlayers = team.teamName;
                      let smallNickname: string | null = null;
                      if (meta !== undefined) {
                        primaryPlayers = formatPlayersPrimaryName(
                          meta.player1Name,
                          meta.player2Name,
                        );
                        smallNickname = formatOptionalTeamNickname(
                          meta.teamName,
                          meta.player1Name,
                          meta.player2Name,
                        );
                      }

                      let isDirect = "false";
                      let isWildcard = "false";
                      let isEliminated = "false";
                      let statusBadge = (
                        <span className="badge badge-fail">Éliminé</span>
                      );

                      if (qual !== undefined && qual.qualified) {
                        if (qual.qualificationReason === "best_wildcards") {
                          isWildcard = "true";
                          statusBadge = (
                            <span className="badge badge-amber">
                              Meilleur 4e · #{qual.bracketSeed}
                            </span>
                          );
                        } else {
                          isDirect = "true";
                          statusBadge = (
                            <span className="badge badge-pass">
                              Qualifié Top 3 · #{qual.bracketSeed}
                            </span>
                          );
                        }
                      } else {
                        isEliminated = "true";
                      }

                      return (
                        <li
                          key={team.teamId}
                          className="pool-standing-row"
                          data-qualified={isDirect}
                          data-wildcard={isWildcard}
                          data-eliminated={isEliminated}
                        >
                          <div className="pool-row-top">
                            <div className="pool-team-ident">
                              <span className="pool-rank-num">
                                {team.poolRank}
                              </span>
                              <span className="pool-team-name">
                                {primaryPlayers}
                              </span>
                            </div>
                            <span className="pool-team-pts">
                              {team.pointsScored} pts
                            </span>
                          </div>

                          <div className="pool-row-bottom">
                            <span>{smallNickname ?? ""}</span>
                            <span>
                              <strong>
                                {team.matchesWon}V–{team.matchesLost}D
                              </strong>{" "}
                              · Diff {formatSignedDiff(team.pointsDiff)}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: "2px",
                            }}
                          >
                            {statusBadge}
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--ink-muted)",
                              }}
                            >
                              Encaissés : {team.pointsConceded} pts
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>

          <article className="wildcard-card">
            <div>
              <span className="eyebrow">
                Départage du dernier ticket · Pas de mini-consolante
              </span>
              <h2 className="section-title" style={{ marginTop: "4px" }}>
                Classement comparatif des Meilleurs 4es
              </h2>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "13px",
                  color: "var(--ink-secondary)",
                }}
              >
                Sur 20 équipes (5 poules de 4), les 3 premiers de chaque poule +
                le meilleur 4e rejoignent les Huitièmes de finale. En cas
                d&apos;égalité parfaite, l&apos;équipe issue de la poule ayant
                cumulé le plus de points l&apos;emporte.
              </p>
            </div>

            <div className="wildcard-list">
              {dataset.qualification.wildcardCandidatesRanked.map(
                (cand, index) => {
                  const meta = dataset.teamMetaById[cand.teamId];
                  let candPlayers = cand.teamName;
                  let candNick: string | null = null;
                  if (meta !== undefined) {
                    candPlayers = formatPlayersPrimaryName(
                      meta.player1Name,
                      meta.player2Name,
                    );
                    candNick = formatOptionalTeamNickname(
                      meta.teamName,
                      meta.player1Name,
                      meta.player2Name,
                    );
                  }

                  let pickedAttr = "false";
                  let badgeNode = (
                    <span className="badge badge-fail">
                      Éliminé ({16 + index}e)
                    </span>
                  );
                  if (cand.qualified) {
                    pickedAttr = "true";
                    badgeNode = (
                      <span className="badge badge-amber">
                        Qualifié · Tête de série #{cand.bracketSeed}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={cand.teamId}
                      className="wildcard-item"
                      data-picked={pickedAttr}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span className="pool-rank-num">{index + 1}</span>
                          <div>
                            <strong
                              className="font-display"
                              style={{
                                fontSize: "18px",
                                textTransform: "uppercase",
                                display: "block",
                                lineHeight: 1.05,
                              }}
                            >
                              {candPlayers}
                            </strong>
                            {candNick !== null && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--ink-muted)",
                                }}
                              >
                                {candNick}
                              </span>
                            )}
                          </div>
                          <span className="badge badge-neutral">
                            {cand.poolLabel}
                          </span>
                        </div>
                        {badgeNode}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          flexWrap: "wrap",
                          fontSize: "12.5px",
                          color: "var(--ink-secondary)",
                        }}
                      >
                        <span>
                          Bilan :{" "}
                          <strong>
                            {cand.matchesWon}V–{cand.matchesLost}D
                          </strong>{" "}
                          · Goal-Average :{" "}
                          <strong>{cand.pointsScored} pts marqués</strong>
                        </span>
                        <span>
                          Force de la poule :{" "}
                          <strong>{cand.poolTotalPoints} pts</strong>
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </article>
        </section>
      )}

      {activeTab === "knockout" && (
        <section
          aria-label="Arbre des phases finales"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          {!summary.hasRealKnockoutBracket && (
            <div className="banner banner-info" role="status">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  width: "100%",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  <strong>Projection temps réel de l&apos;arbre :</strong> les
                  poules sont encore en cours. Pour figer ces affiches et noter
                  les scores des Huitièmes, cliquez sur « Clôturer poules &amp;
                  Générer l&apos;Arbre » dans le poste Admin.
                </span>
                <Link href="/admin" className="btn btn-sm btn-secondary">
                  <LockIcon size={14} />
                  <span>Ouvrir /admin</span>
                </Link>
              </div>
            </div>
          )}

          <div className="cl-bracket-showcase">
            <div className="cl-bracket-backdrop" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={state.tournament.posterUrl}
                alt=""
                className="cl-bracket-poster-bg"
              />
              <div className="cl-bracket-scrim" />
            </div>

            <div className="cl-bracket-inner">
              <div className="cl-bracket-header">
                <div>
                  <span className="cl-bracket-eyebrow">
                    <TrophyIcon size={14} />
                    <span>
                      Huitièmes 500 pts · Quarts 600 pts · Demies 700 pts ·
                      Grande Finale 1000 pts
                    </span>
                  </span>
                  <h2 className="cl-bracket-title">
                    Arbre Officiel · {getPhaseDisplayTitle(selectedKnockoutPhase)}
                  </h2>
                  <p className="cl-bracket-lead">
                    Dès qu&apos;un match atteint son objectif sur{" "}
                    <strong>Ma table</strong> ou <strong>/admin</strong>, les
                    joueurs vainqueurs avancent automatiquement au tour suivant.
                  </p>
                </div>

                <Link
                  href="/live?vue=bracket"
                  className="btn btn-sm btn-primary"
                >
                  <span>Mode Vidéoprojecteur</span>
                </Link>
              </div>

              {/* Sélecteur mobile (375 px) */}
              <div className="knockout-phase-selector cl-bracket-mobile-only">
                {(
                  [
                    { key: "round_of_16", label: "Huitièmes (500)" },
                    { key: "quarterfinals", label: "Quarts (600)" },
                    { key: "semifinals", label: "Demies (700)" },
                    { key: "final", label: "Finale (1000)" },
                  ] as const
                ).map((phaseBtn) => {
                  let activeAttr = "false";
                  if (selectedKnockoutPhase === phaseBtn.key) {
                    activeAttr = "true";
                  }
                  return (
                    <button
                      key={phaseBtn.key}
                      type="button"
                      className="cl-phase-pill"
                      data-active={activeAttr}
                      onClick={() => setSelectedKnockoutPhase(phaseBtn.key)}
                    >
                      {phaseBtn.label}
                    </button>
                  );
                })}
              </div>

              {/* Vue mobile : cartes du tour sélectionné (0 débordement à 375 px) */}
              <div className="knockout-grid cl-bracket-mobile-only">
                {visibleKnockoutMatches.map((match) => {
                  let winnerA = "false";
                  let winnerB = "false";
                  if (
                    match.winnerTeamId !== null &&
                    match.winnerTeamId === match.teamAId
                  ) {
                    winnerA = "true";
                  } else if (
                    match.winnerTeamId !== null &&
                    match.winnerTeamId === match.teamBId
                  ) {
                    winnerB = "true";
                  }

                  const isPlayableMatch =
                    !match.id.startsWith("proj-") &&
                    !match.teamAId.startsWith("pending") &&
                    !match.teamBId.startsWith("pending");
                  const isFinalCard = match.phase === "final";

                  return (
                    <article
                      key={match.id}
                      className="cl-ko-card"
                      data-final={String(isFinalCard)}
                      data-status={match.status}
                    >
                      <div className="cl-ko-card-meta">
                        <span>
                          Match #{match.slot} · Table {match.tableNumber}
                        </span>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "6px",
                            alignItems: "center",
                          }}
                        >
                          <span className="cl-ko-target-chip">
                            {match.targetScore} pts
                          </span>
                          {isPlayableMatch && (
                            <Link
                              href={`/ma-table?match=${encodeURIComponent(match.id)}`}
                              className="cl-ko-score-link"
                            >
                              Noter
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="cl-ko-team-row" data-winner={winnerA}>
                        <div className="cl-ko-team-left">
                          <span className="cl-ko-seed">#{match.seedA}</span>
                          <div className="cl-ko-team-names">
                            <strong className="cl-ko-players">
                              {match.teamAName}
                            </strong>
                            {match.teamABinome.length > 0 && (
                              <span className="cl-ko-nick">
                                {match.teamABinome}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="cl-ko-score tabular-nums">
                          {match.scoreTeamA}
                        </span>
                      </div>

                      <div className="cl-ko-team-row" data-winner={winnerB}>
                        <div className="cl-ko-team-left">
                          <span className="cl-ko-seed">#{match.seedB}</span>
                          <div className="cl-ko-team-names">
                            <strong className="cl-ko-players">
                              {match.teamBName}
                            </strong>
                            {match.teamBBinome.length > 0 && (
                              <span className="cl-ko-nick">
                                {match.teamBBinome}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="cl-ko-score tabular-nums">
                          {match.scoreTeamB}
                        </span>
                      </div>

                      {match.highlightNote !== null && (
                        <div className="cl-ko-note">
                          Info : <strong>{match.highlightNote}</strong>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Vue desktop (>= 980 px) : Arbre complet 4 colonnes avec connecteurs dorés */}
              <div className="cl-bracket-tree cl-bracket-desktop-only">
                {CL_BRACKET_COLUMNS.map((col, colIdx) => {
                  const colMatches = dataset.knockoutMatches
                    .filter((m) => m.phase === col.phase)
                    .sort((a, b) => a.slot - b.slot);
                  if (colMatches.length === 0) {
                    return null;
                  }
                  const isFinalCol = col.phase === "final";
                  const isLastCol = colIdx === CL_BRACKET_COLUMNS.length - 1;
                  const pairs = groupKoMatchesIntoPairs(colMatches);

                  return (
                    <div
                      key={col.phase}
                      className="cl-tree-col"
                      data-final={String(isFinalCol)}
                    >
                      <header className="cl-tree-col-head">
                        <span className="cl-tree-col-title">
                          {isFinalCol && (
                            <TrophyIcon size={15} className="suit-amber" />
                          )}
                          <span>{col.label}</span>
                        </span>
                        <span className="cl-ko-target-chip">
                          {col.targetLabel}
                        </span>
                      </header>

                      <div className="cl-tree-slots">
                        {pairs.map((pair, pairIdx) => {
                          let hasFork = "false";
                          if (!isLastCol && pair.length === 2) {
                            hasFork = "true";
                          }
                          let hasStem = "false";
                          if (!isLastCol && pair.length === 1) {
                            hasStem = "true";
                          }

                          return (
                            <div
                              key={`${col.phase}-p-${pairIdx}`}
                              className="cl-tree-pair"
                              data-fork={hasFork}
                              data-stem={hasStem}
                            >
                              {pair.map((match) => {
                                let winnerA = "false";
                                let winnerB = "false";
                                if (
                                  match.winnerTeamId !== null &&
                                  match.winnerTeamId === match.teamAId
                                ) {
                                  winnerA = "true";
                                } else if (
                                  match.winnerTeamId !== null &&
                                  match.winnerTeamId === match.teamBId
                                ) {
                                  winnerB = "true";
                                }

                                const isPlayableMatch =
                                  !match.id.startsWith("proj-") &&
                                  !match.teamAId.startsWith("pending") &&
                                  !match.teamBId.startsWith("pending");

                                return (
                                  <article
                                    key={match.id}
                                    className="cl-ko-card"
                                    data-final={String(isFinalCol)}
                                    data-status={match.status}
                                  >
                                    <div className="cl-ko-card-meta">
                                      <span>T{match.tableNumber}</span>
                                      {isPlayableMatch && (
                                        <Link
                                          href={`/ma-table?match=${encodeURIComponent(match.id)}`}
                                          className="cl-ko-score-link"
                                        >
                                          Noter
                                        </Link>
                                      )}
                                      {!isPlayableMatch && (
                                        <span>{match.targetScore} pts</span>
                                      )}
                                    </div>

                                    <div
                                      className="cl-ko-team-row"
                                      data-winner={winnerA}
                                    >
                                      <div className="cl-ko-team-left">
                                        <span className="cl-ko-seed">
                                          #{match.seedA}
                                        </span>
                                        <div className="cl-ko-team-names">
                                          <strong className="cl-ko-players">
                                            {match.teamAName}
                                          </strong>
                                          {match.teamABinome.length > 0 && (
                                            <span className="cl-ko-nick">
                                              {match.teamABinome}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="cl-ko-score tabular-nums">
                                        {match.scoreTeamA}
                                      </span>
                                    </div>

                                    <div
                                      className="cl-ko-team-row"
                                      data-winner={winnerB}
                                    >
                                      <div className="cl-ko-team-left">
                                        <span className="cl-ko-seed">
                                          #{match.seedB}
                                        </span>
                                        <div className="cl-ko-team-names">
                                          <strong className="cl-ko-players">
                                            {match.teamBName}
                                          </strong>
                                          {match.teamBBinome.length > 0 && (
                                            <span className="cl-ko-nick">
                                              {match.teamBBinome}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="cl-ko-score tabular-nums">
                                        {match.scoreTeamB}
                                      </span>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "annual" && (
        <section
          aria-label="Classement général annuel Coinch'Eirb"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div className="card-ruled">
            <span className="eyebrow">
              Comptes joueurs optionnels · Saison universitaire
            </span>
            <h2 className="section-title" style={{ marginTop: "4px" }}>
              Classement Général Annuel Coinch&apos;Eirb
            </h2>
            <p
              style={{
                margin: "6px 0 12px",
                fontSize: "13px",
                color: "var(--ink-secondary)",
              }}
            >
              Les joueurs ayant relié un compte facultatif cumulent leurs points
              de classement, victoires, Capots et Générales sur toute
              l&apos;année scolaire.
            </p>

            <div className="annual-controls">
              <div>
                <label className="field-label" htmlFor="annual-search">
                  Rechercher un joueur ou une filière
                </label>
                <input
                  id="annual-search"
                  type="search"
                  className="field-input"
                  placeholder="Ex. Quentin, Adèle, Informatique, Matmeca..."
                  value={annualSearch}
                  onChange={(e) => setAnnualSearch(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="annual-year">
                  Année scolaire
                </label>
                <select
                  id="annual-year"
                  className="field-input"
                  value={annualSchoolYear}
                  onChange={(e) => setAnnualSchoolYear(e.target.value)}
                >
                  <option value="2026-2027">Saison 2026-2027</option>
                  <option value="2025-2026">Archive 2025-2026</option>
                  <option value="ALL">Toutes les saisons</option>
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="annual-promo">
                  Promotion
                </label>
                <select
                  id="annual-promo"
                  className="field-input"
                  value={annualPromoFilter}
                  onChange={(e) => setAnnualPromoFilter(e.target.value)}
                >
                  <option value="ALL">Toutes les promotions</option>
                  <option value="1A (2028)">1A (2028)</option>
                  <option value="2A (2027)">2A (2027)</option>
                  <option value="3A (2026)">3A (2026)</option>
                  <option value="Alumni">Alumni</option>
                </select>
              </div>
            </div>
          </div>

          <div className="annual-list">
            {filteredAnnualPlayers.map((player) => {
              let topAttr = "false";
              if (player.rank <= 3) {
                topAttr = "true";
              }
              return (
                <article
                  key={player.profileId}
                  className="annual-player-card"
                  data-top={topAttr}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span className="pool-rank-num">#{player.rank}</span>
                      <div>
                        <strong
                          className="font-display"
                          style={{
                            fontSize: "19px",
                            textTransform: "uppercase",
                          }}
                        >
                          {player.displayName}
                        </strong>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--ink-secondary)",
                          }}
                        >
                          {player.department} · {player.promotionYear} ·{" "}
                          {player.bestFinishLabel}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        className="font-display tabular-nums"
                        style={{
                          fontSize: "24px",
                          fontWeight: 800,
                          color: "var(--accent-terracotta)",
                        }}
                      >
                        {player.rankingPoints} pts
                      </span>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--ink-muted)",
                        }}
                      >
                        Saison {player.schoolYear}
                      </div>
                    </div>
                  </div>

                  <div className="annual-stats-pills">
                    <span className="badge badge-amber">
                      {player.tournamentsPlayed} tournois (
                      {player.tournamentsWon} titres)
                    </span>
                    <span className="badge badge-pass">
                      {player.matchesWon}/{player.matchesPlayed} victoires
                    </span>
                    <span className="badge badge-neutral">
                      {player.totalPointsScored} pts marqués
                    </span>
                    <span className="badge badge-terracotta">
                      {player.capotsPassed} Capots · {player.generalesPassed}{" "}
                      Générales · {player.coinchesPassed} Coinches
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "stats" && (
        <section
          aria-label="Statistiques de fin de soirée et podium"
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div className="podium-grid">
            <article className="card-ruled">
              <span className="eyebrow">
                <SpadeSuitIcon size={13} />
                <span>1re Place · Finale 1000 pts</span>
              </span>
              <h2 className="section-title" style={{ marginTop: "6px" }}>
                {dataset.eveningStats.podium.winner.teamName}
              </h2>
              <p
                style={{
                  margin: "4px 0 10px",
                  fontSize: "13px",
                  color: "var(--ink-secondary)",
                }}
              >
                {dataset.eveningStats.podium.winner.binome} · Tête de série #
                {dataset.eveningStats.podium.winner.seed}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="badge badge-amber">
                  {dataset.eveningStats.podium.winner.finalScore}
                </span>
                <strong className="font-display tabular-nums">
                  {dataset.eveningStats.podium.winner.totalEveningPoints} pts
                </strong>
              </div>
            </article>

            <article className="card">
              <span className="eyebrow">
                <HeartSuitIcon size={13} />
                <span>Finaliste · 2e Place</span>
              </span>
              <h2 className="section-title" style={{ marginTop: "6px" }}>
                {dataset.eveningStats.podium.finalist.teamName}
              </h2>
              <p
                style={{
                  margin: "4px 0 10px",
                  fontSize: "13px",
                  color: "var(--ink-secondary)",
                }}
              >
                {dataset.eveningStats.podium.finalist.binome} · Tête de série #
                {dataset.eveningStats.podium.finalist.seed}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="badge badge-terracotta">
                  {dataset.eveningStats.podium.finalist.finalScore}
                </span>
                <strong className="font-display tabular-nums">
                  {dataset.eveningStats.podium.finalist.totalEveningPoints} pts
                </strong>
              </div>
            </article>

            <article className="card">
              <span className="eyebrow">
                <DiamondSuitIcon size={13} />
                <ClubSuitIcon size={13} />
                <span>Demi-finalistes · 700 pts</span>
              </span>
              <h2 className="section-title" style={{ marginTop: "6px" }}>
                Dernier Carré Coinch&apos;Eirb
              </h2>
              <div
                style={{
                  marginTop: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                {dataset.eveningStats.podium.semifinalists.map((semi, idx) => (
                  <div
                    key={`${semi.teamName}-${idx}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <span>
                      <strong>#{semi.seed}</strong> {semi.teamName} (
                      {semi.binome})
                    </span>
                    <span className="font-display tabular-nums">
                      {semi.semiScore}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="distinctions-grid">
            {dataset.eveningStats.distinctions.map((dist) => {
              let badgeClass = "badge badge-amber";
              if (dist.accentTone === "terracotta") {
                badgeClass = "badge badge-terracotta";
              } else if (dist.accentTone === "pass") {
                badgeClass = "badge badge-pass";
              } else if (dist.accentTone === "fail") {
                badgeClass = "badge badge-fail";
              }

              return (
                <article key={dist.id} className="card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="eyebrow">{dist.categoryLabel}</span>
                    <span className={badgeClass}>{dist.valueLabel}</span>
                  </div>
                  <h3
                    className="section-title"
                    style={{ marginTop: "6px", fontSize: "19px" }}
                  >
                    {dist.title} · {dist.recipientName}
                  </h3>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "13px",
                      color: "var(--ink-secondary)",
                    }}
                  >
                    {dist.subLabel}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
