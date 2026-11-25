"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  TrophyIcon,
} from "@/components/icons/Icons";
import { useTheme } from "@/components/theme/ThemeProvider";

type AuthTab = "login" | "register";

interface PublicProfileDto {
  id: string;
  displayName: string;
  role: "player" | "admin";
  schoolYear: string;
}

interface AuthMePayload {
  profile: PublicProfileDto | null;
  teamSession: {
    teamId: string;
    tournamentId: string;
    expiresAt: number;
  } | null;
}

const A11Y_CONTRAST_KEY = "coincheirb-a11y-contrast";

function getTabActiveAttr(current: AuthTab, target: AuthTab): "true" | "false" {
  if (current === target) {
    return "true";
  }
  return "false";
}

/**
 * Ecran Settings (/settings) optimise a 375 px :
 * - Bascule theme clair (#F7F2E8) / sombre (#161210)
 * - Compte joueur annuel optionnel (connexion, creation, session, deconnexion)
 * - Accessibilite, acces rapides (/live, /admin) et mentions legales
 */
export function SettingsView() {
  const { theme, setTheme } = useTheme();

  // Session serveur (/api/auth/me)
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [hasTeamSession, setHasTeamSession] = useState<boolean>(false);

  // Onglets Connexion / Creation de compte
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [registerDisplayName, setRegisterDisplayName] = useState<string>("");
  const [registerEmail, setRegisterEmail] = useState<string>("");
  const [registerPassword, setRegisterPassword] = useState<string>("");
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Preferences d'accessibilite locales
  const [highContrast, setHighContrast] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    try {
      const savedContrast = window.localStorage.getItem(A11Y_CONTRAST_KEY);
      if (savedContrast === "high") {
        setHighContrast(true);
        document.documentElement.setAttribute("data-contrast", "high");
      }
    } catch {
      // Stockage local indisponible
    }

    async function fetchMe() {
      try {
        const res = await fetch("/api/auth/me", { method: "GET" });
        if (res.ok) {
          const data = (await res.json()) as AuthMePayload;
          if (!cancelled) {
            setProfile(data.profile);
            setHasTeamSession(data.teamSession !== null);
          }
        }
      } catch {
        // Hors ligne ou serveur non configure
      } finally {
        if (!cancelled) {
          setLoadingSession(false);
        }
      }
    }

    void fetchMe();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleHighContrast() {
    const next = !highContrast;
    setHighContrast(next);
    if (next) {
      document.documentElement.setAttribute("data-contrast", "high");
    } else {
      document.documentElement.removeAttribute("data-contrast");
    }
    try {
      if (next) {
        window.localStorage.setItem(A11Y_CONTRAST_KEY, "high");
      } else {
        window.localStorage.removeItem(A11Y_CONTRAST_KEY);
      }
    } catch {
      // Ignore si stockage bloque
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = loginEmail.trim();
    if (email.length < 5 || !email.includes("@")) {
      setAuthError("Saisissez une adresse email valide.");
      setAuthNotice(null);
      return;
    }
    if (loginPassword.length < 8) {
      setAuthError("Le mot de passe doit contenir au moins 8 caractères.");
      setAuthNotice(null);
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const res = await fetch("/api/auth/player/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: loginPassword,
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        authenticated?: boolean;
        profile?: PublicProfileDto;
        error?: string;
      } | null;

      if (res.ok && body !== null && body.profile !== undefined) {
        setProfile(body.profile);
        setLoginPassword("");
        setAuthNotice(
          `Connexion réussie. Bienvenue ${body.profile.displayName}.`,
        );
        return;
      }

      if (body !== null && typeof body.error === "string") {
        setAuthError(body.error);
      } else {
        setAuthError("Email ou mot de passe incorrect.");
      }
    } catch {
      setAuthError("Impossible de joindre le serveur d'authentification.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = registerDisplayName.trim();
    const email = registerEmail.trim();

    if (displayName.length < 2) {
      setAuthError("Votre pseudo doit contenir au moins 2 caractères.");
      setAuthNotice(null);
      return;
    }
    if (email.length < 5 || !email.includes("@")) {
      setAuthError("Saisissez une adresse email valide.");
      setAuthNotice(null);
      return;
    }
    if (registerPassword.length < 10) {
      setAuthError("Le mot de passe doit contenir au moins 10 caractères.");
      setAuthNotice(null);
      return;
    }

    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const res = await fetch("/api/auth/player/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password: registerPassword,
          schoolYear: "2026-2027",
        }),
      });

      const body = (await res.json().catch(() => null)) as {
        registered?: boolean;
        profile?: PublicProfileDto;
        error?: string;
      } | null;

      if (res.ok && body !== null && body.profile !== undefined) {
        setProfile(body.profile);
        setRegisterPassword("");
        setAuthNotice(
          `Compte annuel créé pour ${body.profile.displayName} (2026-2027).`,
        );
        return;
      }

      if (body !== null && typeof body.error === "string") {
        setAuthError(body.error);
      } else {
        setAuthError("Création du compte impossible avec ces informations.");
      }
    } catch {
      setAuthError("Impossible de joindre le serveur d'inscription.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setProfile(null);
        setHasTeamSession(false);
        setAuthNotice("Vous êtes déconnecté.");
      } else {
        setAuthError("Erreur lors de la déconnexion.");
      }
    } catch {
      setAuthError("Impossible de joindre le serveur.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  let lightActive = "false";
  let darkActive = "false";
  if (theme === "light") {
    lightActive = "true";
  } else {
    darkActive = "true";
  }

  let contrastActive = "false";
  let contrastLabel = "Désactivé";
  if (highContrast) {
    contrastActive = "true";
    contrastLabel = "Activé";
  }

  let loginSubmitLabel = "Se connecter";
  if (authSubmitting) {
    loginSubmitLabel = "Connexion...";
  }

  let registerSubmitLabel = "Créer mon compte annuel";
  if (authSubmitting) {
    registerSubmitLabel = "Création...";
  }

  let logoutLabel = "Se déconnecter";
  if (authSubmitting) {
    logoutLabel = "Déconnexion...";
  }

  let teamSessionSuffix = "";
  if (hasTeamSession) {
    teamSessionSuffix = " · Session table active";
  }

  return (
    <div className="container-mobile">
      <div className="players-stack">
        {/* En-tête + Thème Clair / Sombre */}
        <section className="players-header-card" aria-labelledby="theme-heading">
          <span className="eyebrow">
            <SettingsIcon size={13} />
            <span>Préférences &amp; Profil</span>
          </span>
          <h1 id="theme-heading" className="page-title">
            Settings
          </h1>
          <p className="players-lead">
            Le thème clair papier cartonné (#F7F2E8) est actif par défaut sur
            mobile. Basculez en mode sombre chaud (#161210) en salle tamisée.
          </p>

          <div
            className="segmented"
            role="group"
            aria-label="Choix du thème"
            style={{ marginTop: "4px" }}
          >
            <button
              type="button"
              className="segmented-btn"
              data-active={lightActive}
              onClick={() => setTheme("light")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <SunIcon size={16} />
              <span>Thème clair</span>
            </button>

            <button
              type="button"
              className="segmented-btn"
              data-active={darkActive}
              onClick={() => setTheme("dark")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              <MoonIcon size={16} />
              <span>Thème sombre</span>
            </button>
          </div>
        </section>

        {/* Compte joueur optionnel Coinch'Eirb */}
        <section className="card-ruled" aria-labelledby="account-heading">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TrophyIcon
              size={18}
              style={{ color: "var(--accent-amber)", flexShrink: 0 }}
            />
            <h2 id="account-heading" className="section-title">
              Compte joueur annuel (facultatif)
            </h2>
          </div>

          <p className="players-lead" style={{ marginTop: "6px" }}>
            <strong>100 % optionnel :</strong> vous n&apos;avez besoin d&apos;aucun
            compte pour participer au tournoi du soir. Ce profil sert uniquement
            à cumuler vos résultats personnels sur le classement général
            2026-2027.
          </p>

          {loadingSession && (
            <p className="rules-note-line">
              Vérification de votre session en cours...
            </p>
          )}

          {!loadingSession && profile !== null && (
            <div className="settings-form-stack">
              <div className="banner banner-pass">
                <CheckIcon size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <div>
                    Connecté : <strong>{profile.displayName}</strong>
                  </div>
                  <div style={{ fontSize: "12px", opacity: 0.9 }}>
                    Saison {profile.schoolYear} · Rôle : {profile.role}
                    {teamSessionSuffix}
                  </div>
                </div>
              </div>

              {authNotice !== null && (
                <div className="banner banner-info" role="status">
                  {authNotice}
                </div>
              )}

              {authError !== null && (
                <div className="banner banner-fail" role="alert">
                  {authError}
                </div>
              )}

              <Link href="/equipe" className="btn btn-primary btn-full">
                <span>Rattacher mon profil à mon équipe</span>
                <ArrowRightIcon size={17} />
              </Link>

              <button
                type="button"
                className="btn btn-secondary btn-full"
                onClick={handleLogout}
                disabled={authSubmitting}
              >
                {logoutLabel}
              </button>
            </div>
          )}

          {!loadingSession && profile === null && (
            <div className="settings-form-stack">
              <div
                className="segmented"
                role="tablist"
                aria-label="Connexion ou création de compte"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === "login"}
                  className="segmented-btn"
                  data-active={getTabActiveAttr(authTab, "login")}
                  onClick={() => {
                    setAuthTab("login");
                    setAuthError(null);
                  }}
                >
                  Connexion joueur
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === "register"}
                  className="segmented-btn"
                  data-active={getTabActiveAttr(authTab, "register")}
                  onClick={() => {
                    setAuthTab("register");
                    setAuthError(null);
                  }}
                >
                  Créer un compte
                </button>
              </div>

              {authError !== null && (
                <div className="banner banner-fail" role="alert">
                  {authError}
                </div>
              )}

              {authNotice !== null && (
                <div className="banner banner-pass" role="status">
                  {authNotice}
                </div>
              )}

              {authTab === "login" && (
                <form
                  className="settings-form-stack"
                  style={{ marginTop: 0 }}
                  onSubmit={handleLoginSubmit}
                  noValidate
                >
                  <div>
                    <label htmlFor="login-email" className="field-label">
                      Email joueur
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      className="field-input"
                      placeholder="prenom.nom@bordeaux-inp.fr"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="field-label">
                      Mot de passe (8 caractères min)
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      className="field-input"
                      placeholder="Votre mot de passe"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={authSubmitting}
                  >
                    {loginSubmitLabel}
                  </button>
                </form>
              )}

              {authTab === "register" && (
                <form
                  className="settings-form-stack"
                  style={{ marginTop: 0 }}
                  onSubmit={handleRegisterSubmit}
                  noValidate
                >
                  <div>
                    <label htmlFor="register-name" className="field-label">
                      Pseudo affiché au classement annuel
                    </label>
                    <input
                      id="register-name"
                      type="text"
                      className="field-input"
                      placeholder="Ex. Lucas M."
                      value={registerDisplayName}
                      onChange={(event) =>
                        setRegisterDisplayName(event.target.value)
                      }
                      maxLength={60}
                      autoComplete="nickname"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-email" className="field-label">
                      Adresse email
                    </label>
                    <input
                      id="register-email"
                      type="email"
                      className="field-input"
                      placeholder="prenom.nom@bordeaux-inp.fr"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label htmlFor="register-password" className="field-label">
                      Mot de passe (10 caractères min)
                    </label>
                    <input
                      id="register-password"
                      type="password"
                      className="field-input"
                      placeholder="10 caractères minimum"
                      value={registerPassword}
                      onChange={(event) =>
                        setRegisterPassword(event.target.value)
                      }
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={authSubmitting}
                  >
                    {registerSubmitLabel}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>

        {/* Accessibilité & Accès rapides */}
        <section className="card" aria-labelledby="practical-heading">
          <span className="eyebrow">Accessibilité &amp; Écrans</span>
          <h2
            id="practical-heading"
            className="section-title"
            style={{ marginTop: "4px" }}
          >
            Infos pratiques
          </h2>

          <div style={{ marginTop: "10px" }}>
            <button
              type="button"
              className="sim-toggle-btn"
              data-active={contrastActive}
              aria-pressed={highContrast}
              onClick={toggleHighContrast}
            >
              <span>Contraste renforcé en salle</span>
              <span className="badge badge-amber">{contrastLabel}</span>
            </button>
          </div>

          <div className="settings-links-list">
            <Link href="/live" className="settings-link-row">
              <div>
                <div className="settings-link-title">
                  Vue Vidéoprojecteur (/live)
                </div>
                <div className="settings-link-sub">
                  Poules, meilleurs 4es, arbre final et annonces en direct
                </div>
              </div>
              <ArrowRightIcon size={17} />
            </Link>

            <Link href="/admin" className="settings-link-row">
              <div>
                <div className="settings-link-title">
                  Poste Administrateur (/admin)
                </div>
                <div className="settings-link-sub">
                  Check-in, tirage des poules, alertes arbitre et exports
                </div>
              </div>
              <LockIcon size={17} />
            </Link>
          </div>

          <div className="legal-box" id="mentions-legales">
            <strong style={{ color: "var(--ink-primary)" }}>
              Mentions légales &amp; Confidentialité
            </strong>
            <p style={{ margin: 0 }}>
              Application éditée par le club étudiant Coinch&apos;Eirb
              (ENSEIRB-MATMECA, Bordeaux INP). Contact sur place auprès du
              bureau lors des soirées tournois.
            </p>
            <p style={{ margin: 0 }}>
              Seuls des cookies techniques strictement nécessaires à la session
              de table et au compte joueur optionnel sont utilisés (aucun traceur
              publicitaire ni revente de données).
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
