# Journal de nuit Coinch'Eirb (`OVERNIGHT_REPORT.md`)

Bonjour ! Bonne nouvelle au réveil : j'ai travaillé toute la session sur ton projet sans jamais casser `main`.
Tu as maintenant :
- **5 branches modulaires indépendantes** (pour inspecter chaque brique séparément si tu veux),
- **+ 1 branche complète prête à tester et déployer : `feat/integration-complete-v1` (`249553e`)**, qui **réunit les 5 branches + toutes les améliorations de mes passes d'auto-critique sécurité & design**, validée à **100 %** (**32/32 tests unitaires**, **24/24 routes + 12 API routes**, **zéro opérateur ternaire**, **TypeScript strict**, **zéro tiret cadratin**).

---

## 0. Rappel rapide : Ton mot de passe Admin

- **En développement local (`npm run dev`)** : **`CoincheEirb2026!`** (le champ email est facultatif).
- **En production sur Vercel** : ce mot de passe de test local est **automatiquement désactivé** par le code serveur. Pour mettre ton vrai mot de passe secret avant de déployer :
  ```bash
  npm run hash:password
  ```
  Copie le hash `scrypt$...` affiché et mets-le dans Vercel → Environment Variables → `ADMIN_BOOTSTRAP_PASSWORD_HASH`.

---

## 1. La trame de la nuit : toutes mes décisions & remises en question

Tu m'as demandé de **me remettre en question en permanence**, de corriger dès que je trouvais une faille et de tout documenter. Voici exactement ce que j'ai repéré et modifié au fil de la nuit :

### Passe critique 1 · Base commune `main` (`5f525ae`)
- **Problème repéré** : les photos de soirées, les affiches et la vidéo « Première Donne » étaient rognées (`object-fit: cover`) et la vidéo coupait brutalement à 4,5 s ; le vidéoprojecteur `/live` continuait à afficher les poules même en phase finale ; le lieu s'appelait encore « Foyer ».
- **Décisions appliquées** :
  - Renommage intégral en **« BAR »**.
  - Passage de **100 % des photos & vidéos en `object-fit: contain`** sur fond sombre chaud `#161210` (plus aucune tête coupée, jamais).
  - La vidéo `popup-premiere-donne.mp4` joue désormais **à 100 % jusqu'à `onEnded`** avec barre de progression temps réel ; les memes images restent affichés 5,6 s à 6,8 s.
  - **Rotation intelligente `/live`** : avant 18h30 = Affiche ; 20 premières minutes de poules = **Tables + Poules** ; fin de poules = ajout des **Meilleurs 3es / 4es** ; dès les phases finales (8es / Quarts / Demies / Finale) = **UNIQUEMENT Arbre final + Tables en cours**.

### Passe critique 2 · Boîte à Memes & Soundboard (`feat/banque-memes-communaute` · `44a094f`)
- **Ce que j'ai construit** : route `/memes` avec compression client `<canvas>` (qui nettoie aussi automatiquement les métadonnées GPS EXIF des photos prises sur téléphone), 6 catégories, interrupteur de modération + file `Valider / Refuser` dans `/admin`, tirage **anti-répétition** sur `/live`, et **10 presets Brainrot Web Audio gratuits + import multi-MP3** en rotation aléatoire par événement.
- **Remise en question sécurité** : *« Et si un malin injecte un `data:image/svg+xml` contenant du `<script>` ou spamme 200 photos pour faire planter le `localStorage` du vidéoprojecteur ? »*
- **Correction appliquée** : ajout d'une liste blanche stricte `isSafeMemeImageUrl()` (rejet total de `svg+xml`, `javascript:` et traversées `..`), plafond de 40 memes communautaires, cooldown anti-spam (max 6 envois / min) et test unitaire dédié dans `tests/meme-bank.test.ts`.

### Passe critique 3 · Synchro 40 à 100 téléphones (`feat/synchro-supabase-realtime` · `d72b390`)
- **Ce que j'ai construit** : migration SQL `202611250002_tournament_live_state.sql` (table `tournament_live_snapshots`, RLS lecture publique / écriture serveur uniquement + publication Realtime), route `/api/tournament/state`, reducers atomiques serveur (`src/lib/tournament/state-reducers.ts`) avec **concurrence optimiste (3 tentatives)** pour que Table 1 et Table 7 ne s'écrasent jamais, et repli local automatique en dev sans Supabase.
- **Remise en question sécurité** : *« Que se passe-t-il si quelqu'un tente d'envoyer un forfait pour une autre table via `/api/tournament/state` ou de spammer 500 donnes ? »*
- **Correction appliquée** : contrôle **anti-IDOR** dans `applyTableAlertReducer` (l'équipe doit réellement jouer sur ce match), verrou serveur `423 Locked` si l'admin a bloqué la saisie, plafond de 40 donnes par match, sanitisation serveur de tous les champs texte + 4 tests unitaires (`tests/realtime-sync.test.ts`).

### Passe critique 4 · Refonte visuelle non-IA (`feat/da-club-editorial` · `6dc9a97`)
- **Ce que j'ai construit** : identité **Cercle de Cartes / Sérigraphie ENSEIRB** (papier cartonné 280g `#F3ECE0` avec micro-trame CSS pure, tapis feutre vert `#183022`, géométrie nette `4px`/`6px`), boutons nettement différenciés (primaire estampillé tactile à décalage d'imprimerie `3px 3px 0` qui s'enfonce au clic vs liens éditoriaux soulignés), feuille de marque `/ma-table` façon carnet papier, et **planche-contact numérotée `N°01` à `N°05`** avec tes vraies photos 100 % non rognées.
- **Remise en question design** : *« En mode sombre, les bordures `#e8a628` partout risquent d'être trop agressives, et sur 375 px mobile, 5 photos en grille 2 colonnes feraient une photo orpheline. »*
- **Correction appliquée** : adoucissement de `--border-ink` en mode sombre (`#b98524`), et grille 375 px parfaitement symétrique (`N°01` Vainqueurs pleine largeur sur 2 colonnes + 2 lignes de 2 photos = 1 + 2 + 2 = 5, zéro orphelin, zéro overflow horizontal).

### Passe critique 5 · Comptes club & Verrou anti-troll (`feat/comptes-et-verrou-tables` · `f22f0de`)
- **Ta remarque juste avant de dormir** : *« Si chacun a un compte pseudo + mdp, personne ne peut usurper son identité au classement annuel, mais pour ceux qui ne veulent pas de compte n'importe qui pourrait modifier leur table. »*
- **Décision architecturale adoptée** :
  1. **Comptes club en 10 secondes** (`/api/auth/club-account` + migration SQL `202611250003_club_accounts_and_table_locks.sql`) : `Pseudo` + `Prénom` + `Mot de passe` haché en **`scrypt`**, cookie `httpOnly` signé HMAC (`coincheirb_club_account`).
  2. **Classement annuel protégé** : module `ClubAccountGateCard` dans `/classement`, `/equipe` et `/jouer`. Badges **`Vérifié`** vs **`Invité`** + interrupteur **« Comptes vérifiés uniquement »** sur `/classement`.
  3. **Verrou anti-troll des tables (`/ma-table` + `/admin`)** :
     - Si tu es **Admin** ou **connecté à ton compte joueur assis à cette table** → tu saisis directement sans aucun code.
     - Si tu es **Invité sans compte** → la table s'ouvre en lecture seule jusqu'à saisie du **Code Table à 4 caractères** (ex. `K7M4`, généré de manière déterministe et affiché dans `/admin`). Le 1er téléphone qui valide le code reçoit un cookie signé `httpOnly` **« Téléphone marqueur »** ; **tous les autres téléphones sont bloqués**.
     - Si le téléphone marqueur n'a plus de batterie → l'admin clique **« Libérer téléphone marqueur »** en 1 clic dans `/admin` (incrémente `lockVersion` et invalide instantanément l'ancien cookie).
     - Le bouton **« Appeler un arbitre »** reste toujours actif même en lecture seule.

### Passe critique 6 · Unification & Audit profond (`feat/integration-complete-v1` · `249553e`)
En réunissant les 5 branches dans `feat/integration-complete-v1` et en relisant le projet de bout en bout comme un auditeur externe, j'ai trouvé et corrigé **5 points majeurs supplémentaires** :
1. **BUG CSP PRODUCTION DÉTECTÉ ET CORRIGÉ (`next.config.ts`)** : notre `Content-Security-Policy` avait `img-src ... data: blob:` mais **aucune directive `media-src`** ! En production sur Vercel, `default-src 'self'` aurait silencieusement bloqué la lecture des MP3 uploadés (`data:audio/...`) sur `/live`. J'ai ajouté `"media-src 'self' data: blob: https://*.supabase.co"`.
2. **SÉCURITÉ SERVEUR ANTI-TROLL UNBYPASSABLE (`/api/tournament/state`)** : le verrou de table n'était vérifié que côté UI `/ma-table`. Un étudiant malin en informatique aurait pu appeler `POST /api/tournament/state` depuis DevTools ou `curl`. J'ai donc branché `evaluateTableScorerAccess` **directement côté serveur** dans `POST /api/tournament/state` (`403 Forbidden` si ni Admin, ni compte joueur assis à la table, ni cookie signé de téléphone marqueur).
3. **Export « Story Instagram PNG (1080×1920) » en 1 clic** (`src/lib/classement/story-export.ts` + bouton dans `/classement`) : génère une story prête à poster sur Insta avec le logo abeilles, la photo des vainqueurs **100 % non rognée**, le score de la finale et les stats Capots / Générales / Coinches.
4. **Bouton Admin « Annuler dernière donne »** dans `/admin` (`adminUndoLastDealInStore`) pour corriger proprement une erreur de saisie sans casser l'historique des donnes.
5. **Revanche & Inverser partenaires en 1 clic** sur `/jouer` (après une partie au BAR) + **Manifest PWA** (`src/app/manifest.ts`) pour installer Coinch'Eirb sur l'écran d'accueil iPhone/Android + ajout de `/jouer` et `/memes` au `sitemap.xml`.

---

## 2. Tableau récapitulatif des 6 branches (toutes 100 % vertes)

| Branche | Commit | Contenu principal | Routes clés à tester | Tests Vitest |
| :--- | :--- | :--- | :--- | :---: |
| **`feat/integration-complete-v1`** *(Recommandée)* | `249553e` | **TOUT réuni** (les 5 branches + fix CSP MP3 + anti-troll serveur + Story Insta PNG + PWA + Revanche BAR + Undo Admin) | `/`, `/ma-table`, `/jouer`, `/memes`, `/classement`, `/equipe`, `/live`, `/admin` | **32 / 32** |
| `feat/partie-libre-annuelle` | `e1a985c` | Mode Partie Libre toute l'année au BAR + Classement annuel `+/-` (bonus ×3 tournois) | `/jouer`, `/classement` | 22 / 22 |
| `feat/banque-memes-communaute` | `44a094f` | Boîte à Memes communautaire + modération admin + anti-répétition + 10 presets Brainrot + multi-MP3 | `/memes`, `/admin`, `/live` | 23 / 23 |
| `feat/synchro-supabase-realtime` | `d72b390` | Synchro 40-100 téléphones + `/live` via `/api/tournament/state` & Supabase Realtime (repli local auto) | `/admin`, `/ma-table`, `/live` | 24 / 24 |
| `feat/da-club-editorial` | `6dc9a97` | Refonte visuelle 100 % non-IA (sérigraphie papier 280g, boutons différenciés, carnet de scores, 5 photos) | `/`, `/ma-table`, `/classement` | 20 / 20 |
| `feat/comptes-et-verrou-tables` | `f22f0de` | Comptes club `pseudo + mdp` (`scrypt`), classement annuel vérifié, verrou anti-troll par Code Table 4 car. | `/classement`, `/ma-table`, `/admin` | 23 / 23 |

---

## 3. Commandes rapides pour ce matin

### Option A (la plus simple) : Tester directement la version complète unifiée
```bash
git checkout feat/integration-complete-v1
rm -rf .next && npm run dev
```
Si elle te plaît et que tu veux la passer sur `main` puis pousser sur GitHub :
```bash
git checkout main
git merge --ff-only feat/integration-complete-v1
git push origin main
```
*(Si `main` a avancé avec le commit de ce rapport, fais simplement `git merge feat/integration-complete-v1` puis `git push origin main`.)*

### Option B : Inspecter une branche précise une par une
```bash
git checkout <nom-de-la-branche>
rm -rf .next && npm run dev
```

---

## 4. Checklist de mise en ligne Vercel + Supabase (pour le vrai soir de tournoi)

1. **Dans Supabase → SQL Editor**, exécute dans l'ordre ces 3 fichiers du dossier `supabase/migrations/` :
   1. `202611250001_coincheirb_schema.sql`
   2. `202611250002_tournament_live_state.sql`
   3. `202611250003_club_accounts_and_table_locks.sql`
2. **Génère ton vrai mot de passe Admin** (en local) :
   ```bash
   npm run hash:password
   ```
3. **Dans Vercel → Settings → Environment Variables**, renseigne :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` *(jamais préfixée `NEXT_PUBLIC_`)*
   - `SESSION_HMAC_SECRET` *(chaîne aléatoire de 64 caractères, ex. `openssl rand -hex 32`)*
   - `ADMIN_BOOTSTRAP_PASSWORD_HASH` *(le hash `scrypt$...` généré à l'étape 2)*
   - `NEXT_PUBLIC_SITE_URL` *(ex. `https://coincheirb.vercel.app`)*

---

## 5. Prochaines évolutions envisageables après la V1 (quand tu auras testé au BAR)

1. **Supabase Storage pour les memes & la photo vainqueur** : aujourd'hui les memes uploadés sur `/memes` sont stockés dans le navigateur (idéal en démo ou sur le PC du projecteur). Brancher un bucket `coincheirb-media` permettra à un meme envoyé depuis n'importe quel téléphone au BAR d'apparaître instantanément sur `/live`.
2. **Tes 2 nouvelles photos repérées dans `public/assets/`** : j'ai laissé intacts les fichiers que tu as ajoutés (`public/assets/photo_2026-11-25 11.15.16 PM.jpeg` et `public/assets/media/derniers vainqueurs.jpeg`) sans les toucher ni les supprimer : dis-moi comment tu veux les intégrer quand tu es prêt !
3. **Validation croisée des parties libres au BAR** : sur `/jouer`, ajouter un bouton « Confirmer la partie » par un des adversaires connectés pour que même les parties libres soient 100 % certifiées avant d'ajouter les points `+/-` au classement annuel.
