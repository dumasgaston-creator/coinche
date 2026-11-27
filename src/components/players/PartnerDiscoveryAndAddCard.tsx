"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useClubAccount } from "@/lib/auth/use-club-account";
import {
  computePartnerCompatibilityProfile,
  registerOrUpdateDirectoryPlayer,
  type CasualGameRecord,
  type EnseirbDepartment,
  type EnseirbPromoYear,
  type SchoolPlayerDirectoryEntry,
} from "@/lib/casual/casual-store";
import {
  normalizeComparisonKey,
  sanitizePlainName,
} from "@/lib/security/sanitize";
import {
  formatPlayersPrimaryName,
  updateUnifiedTournamentState,
  type UnifiedTournamentState,
} from "@/lib/tournament/live-store";
import {
  CheckIcon,
  LockIcon,
  SpadeSuitIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons/Icons";

interface PartnerDiscoveryAndAddCardProps {
  tournamentState: UnifiedTournamentState;
  casualGames: readonly CasualGameRecord[];
  directory: readonly SchoolPlayerDirectoryEntry[];
  selectedPartnerName?: string;
  myPlayerName?: string;
  onPartnerReady?: (params: {
    partnerName: string;
    myName: string | null;
    teamId: string | null;
  }) => void;
}

const DEPARTMENTS: readonly EnseirbDepartment[] = [
  "Informatique",
  "Électronique",
  "Télécoms",
  "Matmeca",
  "RSI",
  "ENSEIRB",
];

const PROMOS: readonly EnseirbPromoYear[] = ["1A", "2A", "3A", "Alumni"];

const PLAY_STYLES: readonly string[] = [
  "Coincheur agressif (×2)",
  "Roi du Capot (250 pts)",
  "Spécialiste Générale (500 pts)",
  "Maître Tout Atout",
  "Stratège Sans Atout",
  "Pilier du BAR ENSEIRB",
];

const FAVORITE_ANNOUNCEMENTS: readonly string[] = [
  "Coinche ×2",
  "Capot 250 pts",
  "Générale 500 pts",
  "Surcoinche ×4",
  "Belote & Rebelote",
];

/**
 * Module interactif « Connaitre la personne avec qui on joue & Ajouter un partenaire » :
 * 1. Affiche en direct la fiche de ton partenaire (filiere, promo, style de jeu, bilan ensemble et face-a-face).
 * 2. Lorsqu'on est connecte, permet d'ajouter n'importe quel joueur / partenaire de l'ENSEIRB
 *    meme si on n'est pas cette personne, et de creer instantanement votre binome officiel !
 */
export function PartnerDiscoveryAndAddCard(
  props: PartnerDiscoveryAndAddCardProps,
) {
  const { account } = useClubAccount();

  const [lookupName, setLookupName] = useState<string>("");
  const [newPartnerName, setNewPartnerName] = useState<string>("");
  const [newDepartment, setNewDepartment] =
    useState<EnseirbDepartment>("Informatique");
  const [newPromo, setNewPromo] = useState<EnseirbPromoYear>("2A");
  const [newPlayStyle, setNewPlayStyle] = useState<string>(
    "Coincheur agressif (×2)",
  );
  const [newFavorite, setNewFavorite] = useState<string>("Coinche ×2");
  const [createDuoWithMe, setCreateDuoWithMe] = useState<boolean>(true);
  const [duoNickname, setDuoNickname] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  let effectiveMyName = props.myPlayerName ?? "";
  if (effectiveMyName.trim().length === 0 && account !== null) {
    effectiveMyName = account.firstName;
  }

  let effectivePartnerQuery = lookupName.trim();
  if (
    effectivePartnerQuery.length === 0 &&
    props.selectedPartnerName !== undefined &&
    props.selectedPartnerName.trim().length > 0
  ) {
    effectivePartnerQuery = props.selectedPartnerName.trim();
  }

  const partnerProfile = useMemo(() => {
    if (effectivePartnerQuery.length < 2) {
      return null;
    }
    return computePartnerCompatibilityProfile({
      partnerName: effectivePartnerQuery,
      myName: effectiveMyName,
      casualGames: props.casualGames,
      tournamentState: props.tournamentState,
      directoryEntries: props.directory,
    });
  }, [
    effectivePartnerQuery,
    effectiveMyName,
    props.casualGames,
    props.tournamentState,
    props.directory,
  ]);

  function handleAddPartnerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);

    if (account === null) {
      setErrorMsg(
        "Connecte-toi d'abord avec ton compte Coinch'Eirb pour ajouter un partenaire dans l'annuaire.",
      );
      return;
    }

    const cleanPartner = sanitizePlainName(newPartnerName);
    if (cleanPartner.length < 2) {
      setErrorMsg("Saisis le prénom ou pseudo de la personne avec qui tu joues.");
      return;
    }

    try {
      const entry = registerOrUpdateDirectoryPlayer({
        name: cleanPartner,
        department: newDepartment,
        promoYear: newPromo,
        playStyle: newPlayStyle,
        favoriteAnnouncement: newFavorite,
        addedByPseudo: account.pseudo,
      });

      let createdTeamId: string | null = null;
      let rawMyName = account.firstName;
      if (effectiveMyName.length >= 2) {
        rawMyName = effectiveMyName;
      }
      const myCleanName = sanitizePlainName(rawMyName);

      if (
        createDuoWithMe &&
        myCleanName.length >= 2 &&
        normalizeComparisonKey(myCleanName) !==
          normalizeComparisonKey(entry.name)
      ) {
        const pairPrimary = formatPlayersPrimaryName(myCleanName, entry.name);
        let teamName = sanitizePlainName(duoNickname);
        if (teamName.length === 0) {
          teamName = pairPrimary;
        }
        const pairNormA = normalizeComparisonKey(
          `${myCleanName} / ${entry.name}`,
        );
        const pairNormB = normalizeComparisonKey(
          `${entry.name} / ${myCleanName}`,
        );

        updateUnifiedTournamentState((prev) => {
          const alreadyExists = prev.teams.find((t) => {
            const existingPair = normalizeComparisonKey(
              `${t.player1Name} / ${t.player2Name}`,
            );
            return existingPair === pairNormA || existingPair === pairNormB;
          });
          if (alreadyExists !== undefined) {
            createdTeamId = alreadyExists.id;
            return prev;
          }
          const nextSeed = prev.teams.length + 1;
          const newId = `team-duo-${Date.now()}`;
          createdTeamId = newId;
          return {
            ...prev,
            teams: [
              ...prev.teams,
              {
                id: newId,
                shortCode: `E${String(nextSeed).padStart(2, "0")}`,
                teamName,
                normalizedName: normalizeComparisonKey(teamName),
                player1Name: myCleanName,
                player2Name: entry.name,
                promotionLabel: `${entry.promoYear} ${entry.department}`,
                checkedIn: true,
                isForfeit: false,
                seedOrder: nextSeed,
                player1LinkedAccount: account.pseudo,
                player2LinkedAccount: null,
              },
            ],
          };
        });
      }

      setLookupName(entry.name);
      setNewPartnerName("");
      setDuoNickname("");

      if (props.onPartnerReady !== undefined) {
        props.onPartnerReady({
          partnerName: entry.name,
          myName: myCleanName,
          teamId: createdTeamId,
        });
      }

      let msg = `${entry.name} (${entry.promoYear} ${entry.department}) a été ajouté(e) à l'annuaire ENSEIRB par @${account.pseudo} !`;
      if (createdTeamId !== null) {
        msg = `${entry.name} ajouté(e) + votre binôme "${myCleanName} / ${entry.name}" est enregistré !`;
      }
      setFeedbackMsg(msg);
    } catch (err) {
      let msg = "Impossible d'ajouter ce joueur.";
      if (err instanceof Error) {
        msg = err.message;
      }
      setErrorMsg(msg);
    }
  }

  let chemistryBadgeClass = "badge badge-neutral";
  if (partnerProfile !== null) {
    if (partnerProfile.chemistryTone === "pass") {
      chemistryBadgeClass = "badge badge-pass";
    } else if (partnerProfile.chemistryTone === "amber") {
      chemistryBadgeClass = "badge badge-amber";
    } else if (partnerProfile.chemistryTone === "terracotta") {
      chemistryBadgeClass = "badge badge-terracotta";
    }
  }

  let netTogetherPrefix = "";
  if (partnerProfile !== null && partnerProfile.netPointsTogether > 0) {
    netTogetherPrefix = "+";
  }

  let overallNetPrefix = "";
  if (partnerProfile !== null && partnerProfile.overallNetBalance > 0) {
    overallNetPrefix = "+";
  }

  return (
    <section
      className="card-ruled"
      aria-label="Connaître mon partenaire et ajouter un joueur ENSEIRB"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "10px",
        }}
      >
        <div>
          <span className="eyebrow">
            <UsersIcon size={13} />
            <span>Annuaire &amp; Alchimie Duo ENSEIRB-MATMECA</span>
          </span>
          <h2 className="section-title" style={{ marginTop: "4px" }}>
            Connaître la personne avec qui on joue
          </h2>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            setShowAddForm((prev) => !prev);
            if (
              newPartnerName.trim().length === 0 &&
              effectivePartnerQuery.length >= 2
            ) {
              setNewPartnerName(effectivePartnerQuery);
            }
          }}
        >
          <span>
            {showAddForm && "Masquer l'ajout de partenaire"}
            {!showAddForm && "+ Ajouter un partenaire / joueur"}
          </span>
        </button>
      </div>

      {/* Barre de recherche / sélection rapide d'un joueur pour voir sa fiche */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <input
          type="text"
          list="enseirb-players-list"
          className="field-input"
          style={{ flex: "1 1 220px", minHeight: "40px" }}
          placeholder="Tape le prénom de ton partenaire ou adversaire pour voir sa fiche..."
          value={lookupName}
          onChange={(e) => setLookupName(e.target.value)}
        />
        {props.directory.length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {props.directory.slice(0, 6).map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="chip-btn"
                onClick={() => {
                  setLookupName(entry.name);
                  if (props.onPartnerReady !== undefined) {
                    let myFallback: string | null = null;
                    if (effectiveMyName.length > 0) {
                      myFallback = effectiveMyName;
                    }
                    props.onPartnerReady({
                      partnerName: entry.name,
                      myName: myFallback,
                      teamId: null,
                    });
                  }
                }}
              >
                {entry.name} ({entry.promoYear})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* FICHE PARTENAIRE & COMPATIBILITÉ EN DIRECT */}
      {partnerProfile !== null && (
        <div
          className="card-alt"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "12px",
            border: "1px solid var(--border-strong)",
          }}
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
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexWrap: "wrap",
                }}
              >
                <strong
                  className="font-display"
                  style={{ fontSize: "22px", textTransform: "uppercase" }}
                >
                  {partnerProfile.displayName}
                </strong>
                <span className="badge badge-amber">
                  {partnerProfile.promoYear} · {partnerProfile.department}
                </span>
                <span className="badge badge-neutral">
                  {partnerProfile.playStyle}
                </span>
                {partnerProfile.addedByPseudo !== null && (
                  <span className="badge badge-pass">
                    Ajouté par @{partnerProfile.addedByPseudo}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--ink-secondary)",
                  marginTop: "2px",
                }}
              >
                Annonce favorite :{" "}
                <strong>{partnerProfile.favoriteAnnouncement}</strong> · Bilan
                individuel :{" "}
                <strong>
                  {partnerProfile.overallWins}V–{partnerProfile.overallLosses}D
                </strong>{" "}
                ({partnerProfile.overallWinRatePercent}% · {overallNetPrefix}
                {partnerProfile.overallNetBalance} pts net)
              </div>
            </div>

            <span className={chemistryBadgeClass}>
              <SpadeSuitIcon size={12} />
              <span>{partnerProfile.chemistryLabel}</span>
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
              gap: "8px",
            }}
          >
            <div className="team-kpi-box">
              <span className="team-kpi-label">Parties ensemble (Duo)</span>
              <span className="team-kpi-value">
                {partnerProfile.winsTogether}V – {partnerProfile.lossesTogether}D
              </span>
              <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                {partnerProfile.gamesTogether} match(s) en binôme (
                {partnerProfile.winRateTogetherPercent}%)
              </span>
            </div>

            <div className="team-kpi-box">
              <span className="team-kpi-label">Goal-average en duo</span>
              <span className="team-kpi-value">
                {netTogetherPrefix}
                {partnerProfile.netPointsTogether} pts
              </span>
              <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                {partnerProfile.capotsTogether} Capot(s) ·{" "}
                {partnerProfile.generalesTogether} Générale(s)
              </span>
            </div>

            <div className="team-kpi-box">
              <span className="team-kpi-label">Face-à-face (Adversaire)</span>
              <span className="team-kpi-value">
                {partnerProfile.myWinsAgainst}V –{" "}
                {partnerProfile.myLossesAgainst}D
              </span>
              <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                {partnerProfile.gamesAgainst} duel(s) l&apos;un contre l&apos;autre
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {props.onPartnerReady !== undefined && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  let myFallback: string | null = null;
                  if (effectiveMyName.length > 0) {
                    myFallback = effectiveMyName;
                  }
                  props.onPartnerReady?.({
                    partnerName: partnerProfile.displayName,
                    myName: myFallback,
                    teamId: null,
                  });
                }}
              >
                <CheckIcon size={14} />
                <span>Choisir {partnerProfile.displayName} comme partenaire</span>
              </button>
            )}

            {!partnerProfile.isKnownInDirectory && account !== null && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setNewPartnerName(partnerProfile.displayName);
                  setShowAddForm(true);
                }}
              >
                <span>
                  Enregistrer la fiche de {partnerProfile.displayName} dans
                  l&apos;annuaire
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* FORMULAIRE D'AJOUT D'UN PARTENAIRE / JOUEUR MÊME SI ON N'EST PAS LUI (QUAND CONNECTÉ) */}
      {showAddForm && (
        <div
          className="card-alt"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            padding: "12px",
          }}
        >
          {account === null && (
            <div className="banner banner-info">
              <LockIcon size={15} />
              <span>
                <strong>Connexion requise :</strong> connecte ton compte
                Coinch&apos;Eirb juste au-dessus pour pouvoir ajouter la personne
                avec qui tu joues (même si tu n&apos;es pas elle) et créer votre
                équipe à l&apos;ENSEIRB !
              </span>
            </div>
          )}

          {account !== null && (
            <form
              onSubmit={handleAddPartnerSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
              noValidate
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
                <strong style={{ fontSize: "13.5px" }}>
                  Ajouter un joueur / partenaire ENSEIRB (en tant que @
                  {account.pseudo})
                </strong>
                <span className="badge badge-pass">
                  Ajout tiers autorisé (connecté)
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "8px",
                }}
              >
                <div>
                  <label className="field-label" htmlFor="add-partner-name">
                    Prénom / Pseudo de la personne
                  </label>
                  <input
                    id="add-partner-name"
                    type="text"
                    className="field-input"
                    placeholder="Ex. Jules, Kamila, Mathis..."
                    maxLength={40}
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="add-partner-dept">
                    Filière ENSEIRB
                  </label>
                  <select
                    id="add-partner-dept"
                    className="field-input"
                    value={newDepartment}
                    onChange={(e) =>
                      setNewDepartment(e.target.value as EnseirbDepartment)
                    }
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="add-partner-promo">
                    Année / Promo
                  </label>
                  <select
                    id="add-partner-promo"
                    className="field-input"
                    value={newPromo}
                    onChange={(e) =>
                      setNewPromo(e.target.value as EnseirbPromoYear)
                    }
                  >
                    {PROMOS.map((pr) => (
                      <option key={pr} value={pr}>
                        {pr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "8px",
                }}
              >
                <div>
                  <label className="field-label" htmlFor="add-partner-style">
                    Son style à la table
                  </label>
                  <select
                    id="add-partner-style"
                    className="field-input"
                    value={newPlayStyle}
                    onChange={(e) => setNewPlayStyle(e.target.value)}
                  >
                    {PLAY_STYLES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="add-partner-fav">
                    Son annonce fétiche
                  </label>
                  <select
                    id="add-partner-fav"
                    className="field-input"
                    value={newFavorite}
                    onChange={(e) => setNewFavorite(e.target.value)}
                  >
                    {FAVORITE_ANNOUNCEMENTS.map((fa) => (
                      <option key={fa} value={fa}>
                        {fa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                }}
              >
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={createDuoWithMe}
                    onChange={(e) => setCreateDuoWithMe(e.target.checked)}
                  />
                  <span>
                    Former aussi notre équipe officielle « {account.firstName} /{" "}
                    {newPartnerName.trim() || "Partenaire"} » au classement par
                    équipe ENSEIRB
                  </span>
                </label>

                {createDuoWithMe && (
                  <input
                    type="text"
                    className="field-input"
                    style={{ minHeight: "36px", fontSize: "13px" }}
                    placeholder="Surnom de votre équipe (facultatif, ex. Les Rois du BAR)"
                    maxLength={48}
                    value={duoNickname}
                    onChange={(e) => setDuoNickname(e.target.value)}
                  />
                )}
              </div>

              {errorMsg !== null && (
                <div className="banner banner-fail">{errorMsg}</div>
              )}

              <button type="submit" className="btn btn-primary">
                <TrophyIcon size={16} />
                <span>
                  Ajouter cette personne à l&apos;annuaire &amp; jouer ensemble
                </span>
              </button>
            </form>
          )}
        </div>
      )}

      {feedbackMsg !== null && (
        <div
          className="banner banner-pass"
          role="status"
          style={{ marginTop: "8px" }}
        >
          <CheckIcon size={15} />
          <span>{feedbackMsg}</span>
        </div>
      )}
    </section>
  );
}
