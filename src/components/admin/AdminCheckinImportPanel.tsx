"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertTriangleIcon,
  CheckIcon,
  EditIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons/Icons";
import { INITIAL_DEMO_CSV_SAMPLE } from "@/components/admin/admin-types";
import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import {
  formatOptionalTeamNickname,
  formatPlayersPrimaryName,
} from "@/lib/tournament/live-store";
import {
  parseRegistrationsFromText,
  resolveGoogleSheetsCsvUrl,
  type RawImportedTeamRow,
  type TournamentTeamInput,
} from "@/lib/tournament";

interface AdminCheckinImportPanelProps {
  teams: TournamentTeamInput[];
  registrationsLocked: boolean;
  onImportTeams: (
    rows: RawImportedTeamRow[],
    mode: "replace" | "append",
  ) => void;
  onToggleTeamCheckin: (teamId: string) => void;
  onCheckInAllTeams: (checked: boolean) => void;
  onAddManualTeam: (params: {
    teamName: string;
    player1Name: string;
    player2Name: string;
  }) => void;
  onUpdateTeamDetails: (params: {
    teamId: string;
    teamName: string;
    player1Name: string;
    player2Name: string;
    checkedIn: boolean;
    isForfeit: boolean;
  }) => void;
  onRemoveTeam: (teamId: string) => void;
}

type ImportSourceTab = "paste" | "file" | "sheets";

export function AdminCheckinImportPanel(props: AdminCheckinImportPanelProps) {
  const [sourceTab, setSourceTab] = useState<ImportSourceTab>("paste");
  const [rawImportText, setRawImportText] = useState<string>(
    INITIAL_DEMO_CSV_SAMPLE,
  );
  const [sheetsUrl, setSheetsUrl] = useState<string>("");
  const [sheetsStatus, setSheetsStatus] = useState<string | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState<boolean>(false);

  const [checkinFilter, setCheckinFilter] = useState<string>("");
  const [manualTeamName, setManualTeamName] = useState<string>("");
  const [manualPlayer1, setManualPlayer1] = useState<string>("");
  const [manualPlayer2, setManualPlayer2] = useState<string>("");
  const [manualError, setManualError] = useState<string | null>(null);

  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamName, setEditTeamName] = useState<string>("");
  const [editPlayer1, setEditPlayer1] = useState<string>("");
  const [editPlayer2, setEditPlayer2] = useState<string>("");
  const [editForfeit, setEditForfeit] = useState<boolean>(false);

  const parsedResult = useMemo(() => {
    return parseRegistrationsFromText(rawImportText);
  }, [rawImportText]);

  function handleCsvFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawImportText(reader.result);
        setSourceTab("paste");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleFetchGoogleSheets() {
    setSheetsStatus(null);
    let resolvedCsvUrl: string;
    try {
      resolvedCsvUrl = resolveGoogleSheetsCsvUrl(sheetsUrl);
    } catch (err) {
      let msg = "Lien Google Sheets invalide.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setSheetsStatus(msg);
      return;
    }

    setSheetsLoading(true);
    try {
      const response = await fetch("/api/admin/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetch_google_sheets_csv",
          googleSheetsUrl: resolvedCsvUrl,
        }),
      });

      const data: unknown = await response.json();
      if (
        response.ok &&
        typeof data === "object" &&
        data !== null &&
        "csvText" in data &&
        typeof (data as { csvText: unknown }).csvText === "string"
      ) {
        setRawImportText((data as { csvText: string }).csvText);
        setSheetsStatus("Feuille Google Sheets convertie et analysee avec succes.");
        setSourceTab("paste");
      } else {
        setSheetsStatus(
          `URL d'export CSV validee (${resolvedCsvUrl}). En mode hors-ligne, collez directement les colonnes dans l'onglet Copier-Coller.`,
        );
      }
    } catch {
      setSheetsStatus(
        `URL CSV verifiee (${resolvedCsvUrl}). Collez les cellules dans l'onglet Copier-Coller si le reseau est restreint.`,
      );
    }
    setSheetsLoading(false);
  }

  function handleAddManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setManualError(null);

    let rawP1 = manualPlayer1.trim();
    let rawP2 = manualPlayer2.trim();

    if (rawP2.length === 0 && /[\/&+]/.test(rawP1)) {
      const splitParts = rawP1
        .split(/\s*(?:\/|&|\+)\s*/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (splitParts.length >= 2) {
        rawP1 = splitParts[0] ?? "";
        rawP2 = splitParts.slice(1).join(" ");
      }
    }

    const cleanP1 = sanitizePlainName(rawP1);
    const cleanP2 = sanitizePlainName(rawP2);
    let cleanTeam = sanitizePlainName(manualTeamName);

    if (cleanP1.length < 1 || cleanP2.length < 1) {
      setManualError(
        "Renseignez Joueur 1 et Joueur 2 (ou saisissez « Prénom 1 / Prénom 2 » dans le premier champ). Le surnom est facultatif.",
      );
      return;
    }

    if (cleanTeam.length === 0) {
      cleanTeam = formatPlayersPrimaryName(cleanP1, cleanP2);
    }

    const normP1 = normalizeComparisonKey(cleanP1);
    const normP2 = normalizeComparisonKey(cleanP2);

    if (normP1 === normP2) {
      setManualError("Les deux joueurs d'un binôme doivent être distincts.");
      return;
    }

    const normTeam = normalizeComparisonKey(cleanTeam);
    for (const existing of props.teams) {
      const existingPairNorm = normalizeComparisonKey(
        formatPlayersPrimaryName(existing.player1Name, existing.player2Name),
      );
      const newPairNorm = normalizeComparisonKey(
        formatPlayersPrimaryName(cleanP1, cleanP2),
      );
      if (existingPairNorm === newPairNorm || existing.normalizedName === normTeam) {
        setManualError(`Le binôme "${cleanP1} / ${cleanP2}" est déjà inscrit.`);
        return;
      }
    }

    props.onAddManualTeam({
      teamName: cleanTeam,
      player1Name: cleanP1,
      player2Name: cleanP2,
    });
    setManualTeamName("");
    setManualPlayer1("");
    setManualPlayer2("");
  }

  const normalizedFilter = normalizeComparisonKey(checkinFilter);
  const filteredTeams = props.teams.filter((team) => {
    if (normalizedFilter === "") {
      return true;
    }
    const haystack = normalizeComparisonKey(
      `${team.teamName} ${team.player1Name} ${team.player2Name}`,
    );
    return haystack.includes(normalizedFilter);
  });

  const checkedInCount = props.teams.filter(
    (t) => t.checkedIn && !t.isForfeit,
  ).length;

  let delimiterName = "Virgule (,)";
  if (parsedResult.delimiter === "\t") {
    delimiterName = "Tabulation (Sheets)";
  } else if (parsedResult.delimiter === ";") {
    delimiterName = "Point-virgule (;)";
  }

  let sheetsBtnLabel = "Importer le CSV Google Sheets";
  if (sheetsLoading) {
    sheetsBtnLabel = "Chargement...";
  }

  return (
    <section
      className="admin-panel"
      aria-labelledby="admin-checkin-heading"
    >
      <div className="admin-panel-header">
        <div className="admin-panel-title-wrap">
          <UsersIcon size={20} />
          <h2 id="admin-checkin-heading" className="admin-panel-title">
            Check-in 18h30 &amp; Import Google Sheets
          </h2>
        </div>

        <span className="badge badge-pass tabular-nums">
          {checkedInCount}/{props.teams.length} presents
        </span>
      </div>

      <p className="admin-panel-subtitle">
        Parseur souple sans clé API IA. Collez directement votre Google Sheets{" "}
        <strong>Joueur 1 / Joueur 2 · SURNOM (facultatif)</strong> ou 3
        colonnes classiques : sans surnom, le nom des joueurs est utilisé
        automatiquement et les colonnes bonus sont ignorées.
      </p>

      <div className="admin-import-tabs" role="tablist">
        <button
          type="button"
          className="admin-filter-pill"
          data-active={String(sourceTab === "paste")}
          onClick={() => setSourceTab("paste")}
        >
          1. Copier-coller Sheets
        </button>
        <button
          type="button"
          className="admin-filter-pill"
          data-active={String(sourceTab === "file")}
          onClick={() => setSourceTab("file")}
        >
          2. Fichier .CSV / .TSV
        </button>
        <button
          type="button"
          className="admin-filter-pill"
          data-active={String(sourceTab === "sheets")}
          onClick={() => setSourceTab("sheets")}
        >
          3. Lien Google Sheets
        </button>
      </div>

      {sourceTab === "paste" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="field-label" htmlFor="admin-csv-paste-area">
            Collez les colonnes depuis Google Sheets ou Excel (Separateur
            detecte : {delimiterName})
          </label>
          <textarea
            id="admin-csv-paste-area"
            className="admin-textarea"
            value={rawImportText}
            onChange={(e) => setRawImportText(e.target.value)}
            placeholder="Joueur 1 / Joueur 2&#9;SURNOM (facultatif)"
          />
        </div>
      )}

      {sourceTab === "file" && (
        <div className="card-alt" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="field-label" htmlFor="admin-csv-file-input">
            Charger un fichier `.csv` ou `.tsv` exporte depuis Google Forms / Sheets
          </label>
          <input
            id="admin-csv-file-input"
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
            onChange={handleCsvFileUpload}
          />
        </div>
      )}

      {sourceTab === "sheets" && (
        <div className="card-alt" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label className="field-label" htmlFor="admin-sheets-url-input">
            Lien Google Sheets publie en CSV (`https://docs.google.com/spreadsheets/...`)
          </label>
          <input
            id="admin-sheets-url-input"
            type="url"
            className="field-input"
            style={{ minHeight: "38px", fontSize: "13px" }}
            placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleFetchGoogleSheets}
            disabled={sheetsLoading}
          >
            <span>{sheetsBtnLabel}</span>
          </button>
          {sheetsStatus !== null && (
            <p className="admin-subtitle">{sheetsStatus}</p>
          )}
        </div>
      )}

      {/* Diagnostics temps réel : lignes valides, doublons, erreurs */}
      <div className="admin-import-Diagnostics">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <span className="badge badge-pass tabular-nums">
              {parsedResult.validRows.length} binomes valides
            </span>
            <span className="badge badge-terracotta tabular-nums">
              {parsedResult.duplicates.length} doublon(s)
            </span>
            <span className="badge badge-fail tabular-nums">
              {parsedResult.rowErrors.length} erreur(s) ligne
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={parsedResult.validRows.length === 0}
              onClick={() =>
                props.onImportTeams(parsedResult.validRows, "replace")
              }
            >
              <CheckIcon size={14} />
              <span>Remplacer la liste ({parsedResult.validRows.length})</span>
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={parsedResult.validRows.length === 0}
              onClick={() =>
                props.onImportTeams(parsedResult.validRows, "append")
              }
            >
              <span>+ Fusionner au check-in</span>
            </button>
          </div>
        </div>

        {parsedResult.duplicates.length > 0 && (
          <div className="admin-diagnostic-box admin-diagnostic-warn">
            <strong>
              <AlertTriangleIcon size={14} /> Doublons detectes automatiquement :
            </strong>
            {parsedResult.duplicates.map((dup) => (
              <span key={`${dup.type}-${dup.normalizedKey}`}>
                · {dup.message}
              </span>
            ))}
          </div>
        )}

        {parsedResult.rowErrors.length > 0 && (
          <div className="admin-diagnostic-box admin-diagnostic-err">
            <strong>Lignes ignorees lors de l&apos;analyse :</strong>
            {parsedResult.rowErrors.map((err) => (
              <span key={err.rowNumber}>
                · Ligne {err.rowNumber} : {err.reason}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Liste interactive de check-in avant 18h30 */}
      <div
        style={{
          paddingTop: "10px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div className="admin-checkin-toolbar">
          <input
            type="search"
            className="admin-auth-input"
            style={{ flex: 1 }}
            placeholder="Filtrer une equipe ou un joueur..."
            aria-label="Filtrer la liste de check-in"
            value={checkinFilter}
            onChange={(e) => setCheckinFilter(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => props.onCheckInAllTeams(true)}
          >
            <span>Tout pointer</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => props.onCheckInAllTeams(false)}
          >
            <span>Tout decocher</span>
          </button>
        </div>

        <div className="admin-checkin-list">
          {filteredTeams.map((team) => {
            let checkButtonClass = "btn btn-sm btn-secondary";
            let checkButtonText = "Pointer";
            if (team.checkedIn) {
              checkButtonClass = "btn btn-sm btn-pass";
              checkButtonText = "Présent";
            }

            if (editingTeamId === team.id) {
              return (
                <div
                  key={team.id}
                  className="card-alt"
                  style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                    }}
                  >
                    <input
                      type="text"
                      className="admin-auth-input"
                      aria-label="Joueur 1"
                      placeholder="Joueur 1"
                      value={editPlayer1}
                      onChange={(e) => setEditPlayer1(e.target.value)}
                    />
                    <input
                      type="text"
                      className="admin-auth-input"
                      aria-label="Joueur 2"
                      placeholder="Joueur 2"
                      value={editPlayer2}
                      onChange={(e) => setEditPlayer2(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    className="admin-auth-input"
                    aria-label="Surnom d'équipe (facultatif)"
                    placeholder="Surnom d'équipe (facultatif – vide = noms des joueurs)"
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value)}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <label
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editForfeit}
                        onChange={(e) => setEditForfeit(e.target.checked)}
                      />
                      <span>Forfait</span>
                    </label>

                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => setEditingTeamId(null)}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          const p1Clean = editPlayer1.trim();
                          const p2Clean = editPlayer2.trim();
                          if (p1Clean.length >= 1 && p2Clean.length >= 1) {
                            let resolvedTeamName = editTeamName.trim();
                            if (resolvedTeamName.length === 0) {
                              resolvedTeamName = formatPlayersPrimaryName(
                                p1Clean,
                                p2Clean,
                              );
                            }
                            props.onUpdateTeamDetails({
                              teamId: team.id,
                              teamName: resolvedTeamName,
                              player1Name: p1Clean,
                              player2Name: p2Clean,
                              checkedIn: team.checkedIn,
                              isForfeit: editForfeit,
                            });
                            setEditingTeamId(null);
                          }
                        }}
                      >
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const playersPrimary = formatPlayersPrimaryName(
              team.player1Name,
              team.player2Name,
            );
            const optionalNickname = formatOptionalTeamNickname(
              team.teamName,
              team.player1Name,
              team.player2Name,
            );

            return (
              <div
                key={team.id}
                className="admin-checkin-row"
                data-checked={String(team.checkedIn)}
                data-forfeit={String(team.isForfeit)}
              >
                <div className="admin-checkin-team">
                  <span className="admin-checkin-name">
                    {team.seedOrder !== null && `#${team.seedOrder} · `}
                    {playersPrimary}
                    {team.isForfeit && " (Forfait)"}
                  </span>
                  {optionalNickname !== null && (
                    <span className="admin-checkin-players">
                      {optionalNickname}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <button
                    type="button"
                    className={checkButtonClass}
                    onClick={() => props.onToggleTeamCheckin(team.id)}
                  >
                    {team.checkedIn && <CheckIcon size={13} />}
                    <span>{checkButtonText}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    aria-label={`Modifier ${playersPrimary}`}
                    title="Modifier les joueurs ou le surnom facultatif"
                    onClick={() => {
                      setEditingTeamId(team.id);
                      setEditTeamName(optionalNickname ?? "");
                      setEditPlayer1(team.player1Name);
                      setEditPlayer2(team.player2Name);
                      setEditForfeit(team.isForfeit);
                    }}
                  >
                    <EditIcon size={13} />
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-ghost-danger"
                    aria-label={`Retirer ${playersPrimary}`}
                    onClick={() => props.onRemoveTeam(team.id)}
                  >
                    <XIcon size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ajout manuel d'une équipe de dernière minute */}
        <form className="admin-manual-add-grid" onSubmit={handleAddManualSubmit}>
          <input
            type="text"
            className="admin-auth-input"
            placeholder="Joueur 1 (ou J1 / J2)"
            aria-label="Joueur 1 ou binôme séparé par /"
            value={manualPlayer1}
            onChange={(e) => setManualPlayer1(e.target.value)}
          />
          <input
            type="text"
            className="admin-auth-input"
            placeholder="Joueur 2"
            aria-label="Joueur 2"
            value={manualPlayer2}
            onChange={(e) => setManualPlayer2(e.target.value)}
          />
          <input
            type="text"
            className="admin-auth-input"
            placeholder="Surnom (facultatif)"
            aria-label="Surnom d'équipe facultatif"
            value={manualTeamName}
            onChange={(e) => setManualTeamName(e.target.value)}
          />
          <button type="submit" className="btn btn-sm btn-primary">
            <span>+ Ajouter</span>
          </button>
        </form>
        {manualError !== null && (
          <p className="admin-subtitle" style={{ color: "var(--status-fail)" }}>
            {manualError}
          </p>
        )}
      </div>
    </section>
  );
}
