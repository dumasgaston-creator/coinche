"use client";

import { useEffect, useState } from "react";
import { QrCodeSvg } from "@/components/live/QrCodeSvg";
import { CheckIcon, SpadeSuitIcon, UsersIcon } from "@/components/icons/Icons";
import { useClubAccount } from "@/lib/auth/use-club-account";

interface ShareWebsiteBannerProps {
  compact?: boolean;
}

const DEFAULT_PUBLIC_URL = "https://coincheirb.vercel.app";

/**
 * Bandeau de partage & Lien cliquable universel :
 * - Affiche le lien direct cliquable pour que n'importe qui aille sur le site Coinch'Eirb
 * - Permet de copier le lien en 1 clic, de partager sur WhatsApp / Message,
 *   de generer un lien d'invitation partenaire (`/jouer?partenaire=TonPrenom`)
 *   et d'afficher le QR Code vectoriel scannable au BAR.
 */
export function ShareWebsiteBanner(props: ShareWebsiteBannerProps) {
  const { account } = useClubAccount();
  const [siteUrl, setSiteUrl] = useState<string>(DEFAULT_PUBLIC_URL);
  const [copiedSite, setCopiedSite] = useState<boolean>(false);
  const [copiedInvite, setCopiedInvite] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);

  useEffect(() => {
    const configured = process.env.NEXT_PUBLIC_SITE_URL;
    if (
      configured !== undefined &&
      configured.trim().length > 8 &&
      !configured.includes("localhost")
    ) {
      setSiteUrl(configured.trim().replace(/\/+$/, ""));
      return;
    }
    if (typeof window !== "undefined" && window.location.origin.length > 0) {
      setSiteUrl(window.location.origin);
    }
  }, []);

  let partnerInviteUrl = `${siteUrl}/jouer`;
  if (account !== null && account.firstName.trim().length > 0) {
    partnerInviteUrl = `${siteUrl}/jouer?partenaire=${encodeURIComponent(account.firstName.trim())}`;
  }

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `Rejoins le site officiel Coinch'Eirb (Classements Individuel & Équipes ENSEIRB + Parties au BAR) : ${partnerInviteUrl}`,
  )}`;

  async function handleCopyUrl(targetUrl: string, kind: "site" | "invite") {
    try {
      await navigator.clipboard.writeText(targetUrl);
      if (kind === "site") {
        setCopiedSite(true);
        window.setTimeout(() => setCopiedSite(false), 2500);
      } else {
        setCopiedInvite(true);
        window.setTimeout(() => setCopiedInvite(false), 2500);
      }
    } catch {
      // Fallback
    }
  }

  let copySiteLabel = "Copier le lien du site";
  if (copiedSite) {
    copySiteLabel = "Lien copié !";
  }

  let copyInviteLabel = "Copier lien « Jouer avec moi »";
  if (copiedInvite) {
    copyInviteLabel = "Invitation copiée !";
  }

  return (
    <section
      className="card-ruled"
      aria-label="Lien d'accès rapide et partage du site Coinch'Eirb"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
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
        <div>
          <span className="eyebrow">
            <SpadeSuitIcon size={12} />
            <span>Accès Public ENSEIRB · Lien Cliquable &amp; QR Code</span>
          </span>
          <h2
            className="section-title"
            style={{ marginTop: "4px", fontSize: "18px" }}
          >
            Inviter n&apos;importe qui sur Coinch&apos;Eirb
          </h2>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => setShowQr((prev) => !prev)}
        >
          <span>
            {showQr && "Masquer QR Code"}
            {!showQr && "Afficher QR Code BAR"}
          </span>
        </button>
      </div>

      <div
        className="card-alt"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          padding: "10px 12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
            Lien direct à cliquer ou partager :
          </div>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "14px",
              fontWeight: 800,
              color: "var(--accent-terracotta)",
              textDecoration: "underline",
              wordBreak: "break-all",
            }}
          >
            {siteUrl}
          </a>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              void handleCopyUrl(siteUrl, "site");
            }}
          >
            {copiedSite && <CheckIcon size={14} />}
            <span>{copySiteLabel}</span>
          </button>

          {account !== null && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                void handleCopyUrl(partnerInviteUrl, "invite");
              }}
            >
              <UsersIcon size={14} />
              <span>{copyInviteLabel}</span>
            </button>
          )}

          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-pass"
          >
            <span>Partager WhatsApp</span>
          </a>
        </div>
      </div>

      {showQr && props.compact !== true && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid var(--border-strong)",
            backgroundColor: "#161210",
            color: "#f7f2e8",
          }}
        >
          <div
            style={{
              padding: "6px",
              borderRadius: "6px",
              backgroundColor: "#fffdf8",
            }}
          >
            <QrCodeSvg value={partnerInviteUrl} size={112} />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <strong
              className="font-display"
              style={{
                fontSize: "18px",
                textTransform: "uppercase",
                color: "#e8a628",
              }}
            >
              Scanne pour rejoindre la table
            </strong>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "12.5px",
                color: "#d5c7b8",
              }}
            >
              N&apos;importe quel étudiant au BAR peut scanner ce QR Code avec
              son téléphone pour ouvrir le site, créer son binôme et entrer dans
              le classement de l&apos;ENSEIRB.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
