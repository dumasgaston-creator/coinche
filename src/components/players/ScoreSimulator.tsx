"use client";

import { useState } from "react";
import {
  BELOTE_MIN_CONTRACT_THRESHOLD,
  calculateCoincheDealScore,
} from "@/lib/tournament/scoring";
import type {
  BidMultiplierType,
  ContractBidKind,
} from "@/lib/tournament/types";

const CONTRACT_VALUES: readonly number[] = [
  80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180,
];

function getContractKindActiveAttr(
  current: ContractBidKind,
  target: ContractBidKind,
): "true" | "false" {
  if (current === target) {
    return "true";
  }
  return "false";
}

function getMultiplierActiveAttr(
  current: BidMultiplierType,
  target: BidMultiplierType,
): "true" | "false" {
  if (current === target) {
    return "true";
  }
  return "false";
}

/**
 * Simulateur rapide de donne conforme au reglement officiel Coinch'Eirb.
 * Permet a une table de verifier un score en quelques secondes en plein match.
 */
export function ScoreSimulator() {
  const [takerSide, setTakerSide] = useState<"team_a" | "team_b">("team_a");
  const [contractKind, setContractKind] = useState<ContractBidKind>("points");
  const [contractPoints, setContractPoints] = useState<number>(100);
  const [multiplier, setMultiplier] = useState<BidMultiplierType>("normal");
  const [takerHasBelote, setTakerHasBelote] = useState<boolean>(false);
  const [passed, setPassed] = useState<boolean>(true);
  const [parlanteAgainstTaker, setParlanteAgainstTaker] = useState<number>(0);

  const result = calculateCoincheDealScore({
    takerSide,
    contractKind,
    contractPoints,
    multiplier,
    passed,
    takerHasBelote,
    parlanteCountForTakerOpponent: parlanteAgainstTaker,
  });

  let takerAIsActive = "false";
  let takerBIsActive = "false";
  if (takerSide === "team_a") {
    takerAIsActive = "true";
  } else {
    takerBIsActive = "true";
  }

  let passedActive = "false";
  let failedActive = "false";
  if (passed) {
    passedActive = "true";
  } else {
    failedActive = "true";
  }

  let beloteActive = "false";
  let beloteBadgeLabel = "Non";
  if (takerHasBelote) {
    beloteActive = "true";
    beloteBadgeLabel = "Activée";
  }

  let teamAWinner = "false";
  let teamBWinner = "false";
  if (result.pointsTeamA > result.pointsTeamB) {
    teamAWinner = "true";
  } else if (result.pointsTeamB > result.pointsTeamA) {
    teamBWinner = "true";
  }

  let thresholdExplanation = "Tous les 8 plis requis par l'équipe preneuse.";
  if (contractKind === "generale") {
    thresholdExplanation =
      "Un seul joueur du binôme preneur doit remporter les 8 plis.";
  } else if (result.effectiveTrickThreshold !== null) {
    if (takerHasBelote && contractPoints >= BELOTE_MIN_CONTRACT_THRESHOLD) {
      thresholdExplanation = `Seuil abaissé par la Belote : ${String(result.effectiveTrickThreshold)} pts de plis requis (au lieu de ${String(contractPoints)}). Belote hors score d'annonce.`;
    } else if (takerHasBelote) {
      thresholdExplanation = `Seuil maintenu à ${String(result.effectiveTrickThreshold)} pts : la Belote ne baisse le contrat qu'à partir de 100.`;
    } else {
      thresholdExplanation = `${String(result.effectiveTrickThreshold)} pts de plis requis pour passer le contrat.`;
    }
  }

  let outcomeSummary = "Contrat passé : le preneur marque la valeur de son annonce.";
  if (!passed) {
    outcomeSummary = `Contrat chuté : l'adversaire marque ${String(160 * result.appliedMultiplier)} pts (160 x ${String(result.appliedMultiplier)}).`;
  }

  return (
    <section
      id="simulateur"
      className="card-ruled"
      aria-labelledby="sim-heading"
    >
      <span className="eyebrow">Vérification rapide</span>
      <h2 id="sim-heading" className="section-title" style={{ marginTop: "4px" }}>
        Simulateur de score de donne
      </h2>
      <p className="players-lead" style={{ marginTop: "4px" }}>
        Testez immédiatement une annonce, une Belote, une Coinche ou une
        sanction de parlante.
      </p>

      <div className="settings-form-stack">
        <div>
          <span className="field-label">Équipe preneuse</span>
          <div className="segmented" role="group" aria-label="Équipe preneuse">
            <button
              type="button"
              className="segmented-btn"
              data-active={takerAIsActive}
              onClick={() => setTakerSide("team_a")}
            >
              Équipe A (Nous)
            </button>
            <button
              type="button"
              className="segmented-btn"
              data-active={takerBIsActive}
              onClick={() => setTakerSide("team_b")}
            >
              Équipe B (Eux)
            </button>
          </div>
        </div>

        <div>
          <span className="field-label">Type de contrat</span>
          <div className="players-tabs-3" role="group" aria-label="Type de contrat">
            <button
              type="button"
              className="players-tab-btn"
              data-active={getContractKindActiveAttr(contractKind, "points")}
              onClick={() => setContractKind("points")}
            >
              Points
            </button>
            <button
              type="button"
              className="players-tab-btn"
              data-active={getContractKindActiveAttr(contractKind, "capot")}
              onClick={() => setContractKind("capot")}
            >
              Capot (250)
            </button>
            <button
              type="button"
              className="players-tab-btn"
              data-active={getContractKindActiveAttr(contractKind, "generale")}
              onClick={() => setContractKind("generale")}
            >
              Générale (500)
            </button>
          </div>
        </div>

        {contractKind === "points" && (
          <div>
            <span className="field-label">Annonce choisie</span>
            <div className="sim-chip-row">
              {CONTRACT_VALUES.map((val) => {
                let chipActive = "false";
                if (contractPoints === val) {
                  chipActive = "true";
                }
                return (
                  <button
                    key={val}
                    type="button"
                    className="sim-chip-btn"
                    data-active={chipActive}
                    onClick={() => setContractPoints(val)}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <span className="field-label">Multiplicateur</span>
          <div className="players-tabs-3" role="group" aria-label="Multiplicateur">
            <button
              type="button"
              className="players-tab-btn"
              data-active={getMultiplierActiveAttr(multiplier, "normal")}
              onClick={() => setMultiplier("normal")}
            >
              Normal x1
            </button>
            <button
              type="button"
              className="players-tab-btn"
              data-active={getMultiplierActiveAttr(multiplier, "coinche")}
              onClick={() => setMultiplier("coinche")}
            >
              Coinche x2
            </button>
            <button
              type="button"
              className="players-tab-btn"
              data-active={getMultiplierActiveAttr(multiplier, "surcoinche")}
              onClick={() => setMultiplier("surcoinche")}
            >
              Surcoinche x4
            </button>
          </div>
        </div>

        {contractKind === "points" && (
          <button
            type="button"
            className="sim-toggle-btn"
            data-active={beloteActive}
            aria-pressed={takerHasBelote}
            onClick={() => setTakerHasBelote(!takerHasBelote)}
          >
            <span>Belote &amp; Rebelote chez le preneur (20 pts)</span>
            <span className="badge badge-amber">{beloteBadgeLabel}</span>
          </button>
        )}

        <div>
          <span className="field-label">Issue de la donne</span>
          <div className="segmented" role="group" aria-label="Issue de la donne">
            <button
              type="button"
              className="segmented-btn"
              data-active={passedActive}
              onClick={() => setPassed(true)}
            >
              Contrat passé
            </button>
            <button
              type="button"
              className="segmented-btn"
              data-active={failedActive}
              onClick={() => setPassed(false)}
            >
              Contrat chuté
            </button>
          </div>
        </div>

        <div className="stepper-row">
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700 }}>
              Parlante(s) sanctionnée(s)
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--ink-secondary)" }}>
              +160 pts attribués à l&apos;équipe adverse par parlante
            </div>
          </div>
          <div className="stepper-controls">
            <button
              type="button"
              className="stepper-btn"
              aria-label="Retirer une parlante"
              onClick={() =>
                setParlanteAgainstTaker(Math.max(0, parlanteAgainstTaker - 1))
              }
            >
              -
            </button>
            <span className="stepper-val">{parlanteAgainstTaker}</span>
            <button
              type="button"
              className="stepper-btn"
              aria-label="Ajouter une parlante"
              onClick={() =>
                setParlanteAgainstTaker(Math.min(4, parlanteAgainstTaker + 1))
              }
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="sim-result-box" aria-live="polite">
        <div className="sim-scores-row">
          <div className="sim-team-box" data-winner={teamAWinner}>
            <span className="sim-team-label">Équipe A</span>
            <span className="sim-team-points">+{result.pointsTeamA}</span>
          </div>
          <div className="sim-team-box" data-winner={teamBWinner}>
            <span className="sim-team-label">Équipe B</span>
            <span className="sim-team-points">+{result.pointsTeamB}</span>
          </div>
        </div>

        <div className="sim-meta-line">
          <strong>Seuil de plis :</strong> {thresholdExplanation}
        </div>
        <div className="sim-meta-line">
          <strong>Calcul :</strong> {outcomeSummary}
          {parlanteAgainstTaker > 0 && (
            <span>
              {" "}
              (Parlante : +{String(parlanteAgainstTaker * 160)} pts ajoutés à
              l&apos;adversaire.)
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
