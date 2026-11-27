# Guide Pas-à-Pas : Mettre Coinch'Eirb sur Internet (GitHub + Vercel + Supabase)

Ce guide est fait pour être suivi **à la lettre, de haut en bas, en copier-coller**, à partir de ton dossier actuel (`/Users/gast/Projets/coincheirb`) et de ton dépôt GitHub (`https://github.com/dumasgaston-creator/coinche.git`).

---

## Étape 1 — Choisir tes 3 codes secrets Administrateur (`/admin`)

Pour que personne à l'ENSEIRB (ni sur Internet) ne puisse jamais pirater ton `/admin`, l'accès demande désormais **3 secrets simultanés** que tu vas définir sur Vercel :

1. **Ton Identifiant Bureau** (`ADMIN_IDENTIFIER`)  
   - Par défaut : `bureau-coincheirb` *(tu peux mettre ce que tu veux, ex. `gaston-admin-eirb`)*.
2. **Ton Code PIN de sécurité à 6 chiffres** (`ADMIN_SECURITY_PIN`)  
   - Par défaut : `331830` *(choisis 6 chiffres secrets que seul le Bureau connaît)*.
3. **Ton Mot de passe maître chiffré en `scrypt`** (`ADMIN_BOOTSTRAP_PASSWORD_HASH`)  
   - Ouvre ton Terminal et lance cette commande pour transformer le mot de passe de ton choix en empreinte `scrypt` inviolable :
   ```bash
   cd /Users/gast/Projets/coincheirb
   npm run hash:password -- "TonMotDePasseUltraSecret2026!"
   ```
   - Le terminal va afficher une ligne qui commence par `scrypt$...`. **Garde-la sous les yeux** pour l'Étape 3 (ne mets jamais le mot de passe en clair, uniquement la ligne `scrypt$...`).

---

## Étape 2 — Envoyer la version finale sur ton GitHub (`main`)

Tu es actuellement sur la branche `feat/integration-complete-v1` et ton GitHub est déjà relié à `https://github.com/dumasgaston-creator/coinche.git`.

Copie-colle ce bloc entier dans ton **Terminal** pour tout enregistrer, fusionner dans `main` et pousser sur GitHub :

```bash
cd /Users/gast/Projets/coincheirb

# 1. Enregistre toutes les nouveautés (remise à zéro, sécurité /admin, classements équipe/individuel, partenaire, vrais sons Clash Royale & FAAAAHHH)
git add -A
git commit -m "feat: version production securisee, remise a zero, classements equipe/individuel, ajout partenaire et sons Clash Royale/FAAAAHHH"

# 2. Bascule sur main et fusionne la version finale
git checkout main
git merge feat/integration-complete-v1 -m "Release production Coinch'Eirb"

# 3. Envoie tout sur ton dépôt GitHub
git push origin main
```

---

## Étape 3 — Mettre le site en ligne sur Vercel (2 minutes)

1. Clique sur ce lien : 👉 **[https://vercel.com/new](https://vercel.com/new)**
2. Connecte-toi avec ton compte **GitHub**.
3. Dans la liste **Import Git Repository**, trouve **`dumasgaston-creator/coinche`** et clique sur **Import**.
4. **TRÈS IMPORTANT — Avant de cliquer sur Deploy**, ouvre la section **Environment Variables** et ajoute ces **5 variables** une par une (copie-colle le nom à gauche et la valeur à droite) :

| Name (Nom de la variable) | Value (Valeur à coller) |
| :--- | :--- |
| `SESSION_HMAC_SECRET` | `9f4c8e2a7b1d6f3e5a0c9b8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f` *(ou n'importe quelle suite aléatoire de 64 caractères)* |
| `ADMIN_IDENTIFIER` | Ton identifiant secret choisi à l'Étape 1 (ex. `bureau-coincheirb`) |
| `ADMIN_SECURITY_PIN` | Ton code PIN à 6 chiffres choisi à l'Étape 1 (ex. `331830`) |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | La ligne `scrypt$...` générée à l'Étape 1 *(si tu laisses vide, le mot de passe par défaut est `CoincheEirb2026!`, donc **mets bien ton propre hash `scrypt$...`** avant de partager le site !)* |
| `NEXT_PUBLIC_SITE_URL` | `https://coincheirb.vercel.app` *(ou l'URL `.vercel.app` que Vercel te donne)* |

5. Clique sur le bouton **Deploy**.
6. Attends ~45 secondes : **ton site est officiellement en ligne sur Internet en HTTPS !** 🎉

---

## Étape 4 — (Recommandé pour les soirées à 40-100 téléphones) Activer la base Temps Réel Supabase Gratuite

Le site fonctionne déjà immédiatement à l'Étape 3. Pour que **tous les téléphones du BAR et le vidéoprojecteur `/live`** soient synchronisés sur une vraie base PostgreSQL temps réel gratuite :

1. Crée un projet gratuit sur 👉 **[https://supabase.com/dashboard](https://supabase.com/dashboard)** (choisis la région `West EU (Paris)` ou `Frankfurt`).
2. Dans le menu de gauche de Supabase, clique sur **SQL Editor** -> **New query**.
3. Copie-colle et exécute (**Run**) l'un après l'autre le contenu de ces 3 fichiers de ton projet :
   - **Script 1** : [supabase/migrations/0001_initial_schema_and_rls.sql](file:///Users/gast/Desktop/AI/coincheirb/supabase/migrations/0001_initial_schema_and_rls.sql)
   - **Script 2** : [supabase/migrations/202611250002_tournament_live_state.sql](file:///Users/gast/Desktop/AI/coincheirb/supabase/migrations/202611250002_tournament_live_state.sql)
   - **Script 3** : [supabase/migrations/202611250003_club_accounts_and_table_locks.sql](file:///Users/gast/Desktop/AI/coincheirb/supabase/migrations/202611250003_club_accounts_and_table_locks.sql)
4. Dans Supabase, va dans **Project Settings** (icône engrenage en bas à gauche) -> **API**, puis copie tes 3 clés dans **Vercel > Ton Projet > Settings > Environment Variables** :
   - `NEXT_PUBLIC_SUPABASE_URL` : l'URL de ton projet (`https://xxxx.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : la clé `anon` / `public`
   - `SUPABASE_SERVICE_ROLE_KEY` : la clé `service_role` *(secret serveur uniquement, ne jamais la partager)*
5. Dans Vercel, va dans l'onglet **Deployments**, clique sur les `...` du dernier déploiement puis **Redeploy** pour activer Supabase.

---

## Étape 5 — Comment utiliser et partager ton site au quotidien à l'ENSEIRB

### 1. Partager le site à toute l'école en 1 clic
- Sur la page d'accueil `/`, sur `/jouer` et sur `/classement`, tu as désormais le bloc **« Inviter n'importe qui sur Coinch'Eirb »** :
  - Clique sur **Copier le lien du site** ou **Partager WhatsApp** pour l'envoyer sur les groupes de promo ENSEIRB.
  - Clique sur **Afficher QR Code BAR** pour que les étudiants à côté de toi scannent ton écran avec leur appareil photo et arrivent direct sur le site.
  - Quand tu es connecté à ton compte, clique sur **Copier lien « Jouer avec moi »** : ça envoie un lien `/jouer?partenaire=TonPrenom` qui te pré-remplit automatiquement comme partenaire sur le téléphone de ton pote !

### 2. Ajouter tes partenaires et construire le classement à partir de zéro
- Va sur `/jouer`, `/equipe` ou `/classement`.
- Crée ton compte joueur en 5 secondes (ex. pseudo `Gaston` + mot de passe).
- Une fois connecté, clique sur **`+ Ajouter un partenaire / joueur`** :
  - Tu peux ajouter la personne avec qui tu joues **même si tu n'es pas elle** (son prénom, sa filière Info/Élec/Télécoms/Matmeca/RSI, sa promo 1A/2A/3A, son style de jeu).
  - Laisse cochée la case **« Former aussi notre équipe officielle »** : votre binôme est instantanément créé dans le **Classement par Équipe ENSEIRB** (*« Quelles sont les équipes qui gagnent le plus à l'ENSEIRB ? »*) et vous deux apparaissez dans le **Classement Individuel ENSEIRB** !

### 3. Accéder à ton poste `/admin` secret les soirs de tournoi
- Aucun bouton `/admin` n'est visible pour les visiteurs afin d'éviter les curieux.
- Pour ouvrir ton cockpit d'administration, ajoute simplement **`/admin`** à la fin de l'adresse de ton site (ex. `https://coincheirb.vercel.app/admin`).
- Entre tes **3 secrets** définis à l'Étape 1 (**Identifiant Bureau** + **Mot de passe maître** + **Code PIN à 6 chiffres**).
- *(Sécurité active : si quelqu'un essaie de deviner tes codes et échoue 4 fois, son adresse IP est automatiquement bloquée pendant 30 minutes.)*
- Quand tu as fini de gérer le tournoi, clique sur **Verrouiller Admin** en haut à droite.
