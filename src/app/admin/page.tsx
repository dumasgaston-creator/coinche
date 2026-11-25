import type { Metadata } from "next";
import "@/components/admin/admin.css";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { getOptionalAuthenticatedProfile } from "@/lib/auth/guards";
import { isProductionEnvironment } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin | Tournoi Coinch'Eirb",
  description:
    "Poste de pilotage temps réel Coinch'Eirb : check-in Google Sheets, génération des poules, tables, scores forcés et alertes arbitre.",
};

/**
 * Route `/admin` : verifie la session Administrateur cote serveur avant le premier rendu
 * afin d'afficher instantanement soit le formulaire mot de passe, soit le poste de pilotage.
 */
export default async function AdminPage() {
  const authContext = await getOptionalAuthenticatedProfile();

  let initialIsAdmin = false;
  let initialAdminName = "Bureau Coinch'Eirb";

  if (authContext !== null && authContext.profile.role === "admin") {
    initialIsAdmin = true;
    initialAdminName = authContext.profile.display_name;
  }

  const customHashConfigured =
    (process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() ?? "").startsWith(
      "scrypt$",
    );
  const initialDevHintAvailable =
    !isProductionEnvironment() && !customHashConfigured;

  return (
    <AdminDashboardClient
      initialIsAdmin={initialIsAdmin}
      initialAdminName={initialAdminName}
      initialDevHintAvailable={initialDevHintAvailable}
    />
  );
}
