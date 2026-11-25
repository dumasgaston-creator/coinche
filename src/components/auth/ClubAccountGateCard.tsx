"use client";

import { useState, type FormEvent } from "react";
import { useClubAccount } from "@/lib/auth/use-club-account";
import { CheckIcon, LockIcon, UsersIcon } from "@/components/icons/Icons";

interface ClubAccountGateCardProps {
  title?: string;
  compact?: boolean;
}

/**
 * Module d'inscription / connexion rapide en 10 secondes (`pseudo + mot de passe` scrypt).
 * Protege le classement general annuel contre toute usurpation d'identite.
 */
export function ClubAccountGateCard(props: ClubAccountGateCardProps) {
  const { account, loading, register, login, logout } = useClubAccount();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [pseudo, setPseudo] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg(null);
    setOkMsg(null);
    setSubmitting(true);

    if (mode === "register") {
      const res = await register({
        pseudo: pseudo.trim(),
        firstName: firstName.trim(),
        password,
      });
      setSubmitting(false);
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
      setPassword("");
      setOkMsg("Compte créé et protégé ! Tes points comptent au classement annuel.");
      return;
    }

    const res = await login({
      pseudo: pseudo.trim(),
      password,
    });
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setPassword("");
    setOkMsg("Connecté !");
  }

  if (loading) {
    return null;
  }

  if (account !== null) {
    return (
      <div
        className="card-alt"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="badge badge-pass">
            <CheckIcon size={12} />
            <span>Compte vérifié</span>
          </span>
          <strong style={{ fontSize: "14px" }}>{account.pseudo}</strong>
          <span style={{ fontSize: "12px", color: "var(--ink-muted)" }}>
            ({account.firstName} · {account.schoolYear})
          </span>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => {
            void logout();
          }}
        >
          Déconnexion
        </button>
      </div>
    );
  }

  let heading = "Compte requis pour entrer au classement annuel";
  if (props.title !== undefined) {
    heading = props.title;
  }

  let submitLabel = "Créer mon compte protégé";
  if (mode === "login") {
    submitLabel = "Me connecter";
  }
  if (submitting) {
    submitLabel = "Vérification...";
  }

  return (
    <section className="card-ruled" aria-label={heading}>
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <LockIcon size={16} />
          <strong style={{ fontSize: "14px" }}>{heading}</strong>
        </div>

        <div className="segmented" style={{ maxWidth: "240px" }}>
          <button
            type="button"
            className="segmented-btn"
            data-active={String(mode === "register")}
            onClick={() => {
              setMode("register");
              setErrorMsg(null);
            }}
          >
            Créer
          </button>
          <button
            type="button"
            className="segmented-btn"
            data-active={String(mode === "login")}
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
            }}
          >
            Connexion
          </button>
        </div>
      </div>

      {props.compact !== true && (
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "12.5px",
            color: "var(--ink-secondary)",
          }}
        >
          Ton pseudo est verrouillé par mot de passe : personne ne peut usurper
          ton nom ni modifier tes tables. Les joueurs sans compte restent en
          invités hors classement annuel.
        </p>
      )}

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        noValidate
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "8px",
          }}
        >
          <input
            type="text"
            className="field-input"
            placeholder="Pseudo (ex. Angele_EIRB)"
            maxLength={40}
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            required
          />
          {mode === "register" && (
            <input
              type="text"
              className="field-input"
              placeholder="Prénom (pour tes tables)"
              maxLength={40}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          )}
          <input
            type="password"
            className="field-input"
            placeholder="Mot de passe (6+ car.)"
            maxLength={100}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMsg !== null && (
          <div className="banner banner-fail" role="alert">
            {errorMsg}
          </div>
        )}
        {okMsg !== null && (
          <div className="banner banner-pass" role="status">
            <UsersIcon size={15} />
            <span>{okMsg}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={submitting}
          style={{ alignSelf: "flex-start" }}
        >
          {submitLabel}
        </button>
      </form>
    </section>
  );
}
