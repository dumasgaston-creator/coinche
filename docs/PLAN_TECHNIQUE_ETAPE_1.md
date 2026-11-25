# Plan Technique Concis - Coinch'Eirb (Etape 1)

## 1. Architecture cible (Next.js 15 + Supabase Temps Reel + Vercel)

- **Runtime & Deploiement** : Next.js 15 (App Router, TypeScript strict) deploye sur Vercel Serverless (region `cdg1` Paris pour minimiser la latence depuis le campus ENSEIRB-MATMECA). Capacite dimensionnee pour 40 a 100 connexions simultanees sur le plan gratuit Supabase (limite de 200 connexions Realtime simultanees, large marge avec 1 telephone actif par table + 1 videoprojecteur `/live` + 1 poste `/admin`).
- **Separation stricte Client / Serveur** :
  - **Client (`anon` key uniquement)** : Souscriptions WebSocket `postgres_changes` filtrees par `tournament_id` pour `/live`, `/admin` et l'onglet mobile `Ma table`. Aucune cle secrete dans le bundle navigateur.
  - **Serveur (`server-only`)** : Route Handlers (`src/app/api/**`) et gardes d'acces (`src/lib/auth/guards.ts`) executant les validations Zod, la limitation de debit, la verification anti-IDOR, le hachage `scrypt` des secrets et les mutations sensibles via le client serveur Supabase.

## 2. Modele de donnees & Securite RLS (13 tables)

Toutes les tables activent `ENABLE ROW LEVEL SECURITY` et `FORCE ROW LEVEL SECURITY` :

1. `profiles` : Comptes lies a `auth.users` (`admin` ou `player` optionnel). Escalade de role bloquee par RLS + trigger SQL.
2. `tournaments` : Configuration de la soiree (verrouillage inscriptions, edition scores joueurs, seuil des 8es par defaut a 12, cibles 500/600/700/1000 pts, affiche dynamique).
3. `teams` : Equipes inscrites, joueurs 1 & 2, liens optionnels vers `profiles`, statut check-in avant 18h30 et forfait.
4. `team_secrets` : Codes courts d'acces table haches cote serveur (`scrypt`). **Isolation totale** : jamais exposee en lecture publique ni sur Realtime (`SELECT` reserve a `is_admin()`).
5. `pools` : Poules generees avec cumul des points (`total_points_scored`) servant au departage par poule la plus forte.
6. `pool_memberships` : Classement intra-poule, victoires, goal-average (points marques) et statut de qualification.
7. `matches` : Rencontres de poules (5 donnes + 6e donne si egalite) et d'arbre final (8es, Quarts, Demies, Finale), assignation de table et verrouillage individuel.
8. `match_deals` : Historique donne par donne avec annonces manuelles (`capot`, `generale`, `coinche`, `surcoinche`) et penalites de parlante.
9. `live_announcements` : File d'attente temps reel des pop-ups GSAP du videoprojecteur (`announced` puis `passed` / `failed`).
10. `referee_alerts` : Appels arbitre et demandes d'abandon remontes instantanement sur `/admin`.
11. `annual_leaderboard_entries` : Performances agregees sur l'annee scolaire pour les joueurs disposant d'un compte optionnel.
12. `rate_limit_buckets` : Compteurs atomiques de limitation de tentatives compatibles Vercel Serverless.
13. `security_audit_logs` : Journalisation serveur des actions sensibles (forfaits, editions forcees, verrouillages, echecs auth).

## 3. Authentification Serveur en 3 niveaux & Anti-IDOR

- **Administrateur** : Session Supabase Auth cote serveur (`@supabase/ssr`, cookies `httpOnly`, `secure`, `sameSite=lax`) + verification systématique en base `profiles.role = 'admin'` via `requireAdmin()`.
- **Compte joueur optionnel** : Inscription/connexion Supabase Auth (`role = 'player'`) permettant de rattacher ses tournois (avec verification du code court d'equipe) pour alimenter le classement annuel.
- **Acces rapide Table / Equipe (sans compte obligatoire)** : Verification cote serveur du code court de l'equipe (comparaison `timingSafeEqual` sur hash `scrypt`) et emission d'un cookie signe HMAC-SHA256 (`coincheirb_team_session`, `httpOnly`, `secure`, `sameSite=lax`).
- **Protection Anti-IDOR** : Chaque lecture privee ou saisie de score verifie cote serveur (`requireMatchAccess`) que la session correspond exactement a `team_a_id` ou `team_b_id` du match vise (ou `admin`), et que `player_score_editing_enabled` et `!locked_by_admin` sont actifs.

## 4. Moteur Algorithmique Deterministe (`src/lib/tournament/**`)

- **`csv-import.ts`** : Parseur deterministe sans IA supportant CSV (`,`, `;`), copier-coller TSV depuis Google Sheets et URL publiee Google Sheets (avec validation anti-SSRF `docs.google.com`). Detection normalisee des doublons d'equipes et de joueurs, generation des entrees de check-in et des codes courts sans caracteres ambigus.
- **`pool-generator.ts`** : Repartition optimale deterministe pour tout effectif pair ou impair (`P = ceil(N / 4)` pour `N >= 6`, `P = 1` pour `N = 4..5`). Pour 20 equipes : exactement 5 poules de 4. Calendrier round-robin (methode du cercle) en 3 tours maximum pour tout `N >= 6`, distribution en serpentin et assignation sequentielle des tables.
- **`scoring.ts`** : Calcul officiel Coinch'Eirb a l'annonce (contrat passe = annonce, chute = 160 adversaire, belote abaissant le seuil uniquement a partir de 100 hors points marques, coinche x2, surcoinche x4, capot 250, generale 500, parlante 160 adversaire, 6e donne obligatoire si egalite apres 5 donnes en poule).
- **`qualification.ts` & `bracket.ts`** : Classement intra-poule (`victoires` -> `points marques`) et departage inter-poules des meilleurs classés de meme rang avec egalite parfaite tranchee par la **poule la plus forte** (somme totale des points marques dans la poule). Application stricte du **seuil des Huitiemes** (`> 12` equipes par defaut -> passage obligatoire en Huitiemes de finale en 500 pts, avec exempts automatiques si `13 <= N <= 15`, jamais de saut direct en Quarts).
