import type { Metadata } from "next";
import "@/components/admin/admin.css";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { getOptionalAuthenticatedProfile } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Poste Administrateur | Tournoi Coinch'Eirb",
  description:
    "Poste de pilotage sécurisé Coinch'Eirb : check-in Google Sheets, génération des poules, tables et alertes arbitre.",
};

/**
 * Route `/admin` : verifie la session Administrateur cote serveur avant le premier rendu.
 * Aucun indice de mot de passe ni bouton de test n'est expose.
 */
export default async function AdminPage() {
  const authContext = await getOptionalAuthenticatedProfile();

  let initialIsAdmin = false;
  let initialAdminName = "Bureau Coinch'Eirb";

  if (authContext !== null && authContext.profile.role === "admin") {
    initialIsAdmin = true;
    initialAdminName = authContext.profile.display_name;
  }

  return (
    <AdminDashboardClient
      initialIsAdmin={initialIsAdmin}
      initialAdminName={initialAdminName}
    />
  );
}
