# Rapport de nuit Coinch'Eirb (`OVERNIGHT_REPORT.md`)

Bonjour ! Pendant que tu dormais, j'ai sécurisé la base `main` (sans jamais la casser) et construit **4 branches Git indépendantes**, toutes compilées, testées et vérifiées à 100 % avec `npm run verify` (zéro opérateur ternaire, TypeScript strict, tests Vitest verts, build Next.js production complet, zéro tiret cadratin).

---

## 0. Ce qui est déjà sur `main` (commit `5f525ae`)

Avant même de créer les 4 branches, j'ai consolidé la base commune sur `main` :
- **Nom du lieu** : remplacé partout par **« BAR »** (accueil, stats, textes tournoi).
- **Photos & vidéo 100 % non rognées** : passage en `object-fit: contain` sur cadres sombres `#161210` (plus aucune tête, affiche ou vidéo coupée sur l'accueil, `/classement` et `/live`).
- **Vidéo « Première Donne » jouée à 100 %** : le pop-up vidéo `popup-premiere-donne.mp4` ne coupe plus à 4,5 s, il se termine uniquement sur `onEnded` avec barre de progression temps réel (et les memes images restent 5,6 s à 6,8 s).
- **Rotation intelligente du vidéoprojecteur `/live`** :
  - Avant 18h30 : Affiche uniquement.
  - Poules (20 premières minutes) : **Tables en cours + Poules** uniquement.
  - Fin de poules : ajout automatique des **Meilleurs 3es / 4es**.
  - Dès l'entrée en **Phase finale (8es / Quarts / Demies / Finale)** : **UNIQUEMENT Arbre final + Tables en cours** (on n'affiche plus les poules).
- **Soundboard Brainrot gratuit (Web Audio API)** + upload MP3 + **Photo Vainqueur Live** depuis `/admin` + **nombre d'équipes libre** (4 à 64+ équipes).

---

## 1. Résumé des 4 branches indépendantes

### Branche 1 : `feat/partie-libre-annuelle` (`e1a985c`)
**Objectif** : Utiliser l'appli toute l'année au BAR en dehors des tournois, et alimenter un vrai classement annuel `+/-`.
- **Nouvelle route `/jouer`** :
  - Tu choisis ton partenaire (prénom/nom) et les 2 adversaires avec **annuaire auto-alimenté** des joueurs de l'école (datalist intelligente).
  - Saisie en direct par donne (avec raccourcis coinche `80`, `100`, `120`, `160`, `250`, `500` + bouton `Parlante +160`) et historique complet des parties jouées au BAR (pour savoir qui tu as déjà affronté et ton bilan contre eux).
  - Fin de partie configurable (500 / 700 / 1000 / 1500 / 2000 pts) avec calcul instantané des points nets `+/-`.
- **Classement annuel enrichi sur `/classement`** :
  - Combine en temps réel les **parties libres au BAR** et les **tournois officiels** (avec **bonus ×3** sur les tournois officiels).
  - Affiche le solde positif/négatif (`+pts` / `-pts`), le taux de victoire, le **meilleur partenaire** et la **bête noire**.
- **Tests ajoutés** : `tests/casual-and-annual.test.ts` (22/22 tests verts).
- **Routes à tester** : `/jouer`, `/classement`, `/`.

---

### Branche 2 : `feat/banque-memes-communaute` (`44a094f`)
**Objectif** : Laisser les joueurs envoyer leurs propres memes / photos du club pour qu'ils passent automatiquement en rotation sur `/live`, avec un soundboard Brainrot ultra-complet.
- **Nouvelle route `/memes` (« Boîte à Memes & Photos »)** :
  - Upload photo/meme depuis téléphone avec **compression client `<canvas>`** (qui supprime aussi automatiquement les métadonnées GPS EXIF des photos), **vérification magic bytes** (JPEG/PNG/WebP réels) et affichage **100 % non rogné**.
  - 6 catégories : `Coinche / Surcoinche`, `Capot`, `Générale`, `Contrat chuté`, `Éliminé (Capri-Seum)`, `Ambiance BAR`.
  - Galerie filtrable par catégorie.
- **Modération côté `/admin`** :
  - Interrupteur ON/OFF (`Validation Admin : ON` / `Publication libre : ON`) + file d'attente avec boutons `Valider` / `Refuser`.
- **Rotation anti-répétition sur `/live`** :
  - Le moteur `pickNonRepeatingMeme()` garantit de **ne jamais afficher 2 fois le même meme d'affilée** dans une catégorie.
- **Soundboard Brainrot étendu + multi-MP3** :
  - 10 effets intégrés gratuits (`Vine Boom`, `FAAAAHHH`, `MLG Airhorn x3`, `Trombone Capri-Seum`, `Bruh`, `Oof`, `Sirène Coinche`, `Sigma Phonk Basse`, `Boing Cartoon`, `Fanfare Champions`).
  - Import **multi-MP3** par événement (tu peux sélectionner plusieurs MP3 pour un même événement, joués en rotation aléatoire sans répétition).
- **Améliorations sécurité appliquées lors de ma passe critique** :
  - Validation stricte `isSafeMemeImageUrl()` qui rejette `data:image/svg+xml` (risque XSS), `javascript:` et toute traversée de chemin `..`.
  - Plafond de 40 memes communautaires (anti-saturation `localStorage`) + cooldown anti-spam (max 6 envois / minute).
- **Tests ajoutés** : `tests/meme-bank.test.ts` (23/23 tests verts).
- **Routes à tester** : `/memes`, `/admin` (bloc Modération + Sons multi-MP3), `/live` (bouton `Pop-up`).

---

### Branche 3 : `feat/synchro-supabase-realtime` (`d72b390`)
**Objectif** : Synchroniser en direct **40 à 100 téléphones différents**, `/admin` et le vidéoprojecteur `/live` en production sur Vercel, avec **repli local automatique** si Supabase n'est pas encore configuré.
- **Nouvelle migration SQL** : `supabase/migrations/202611250002_tournament_live_state.sql`
  - Table `public.tournament_live_snapshots` avec RLS activée : lecture publique autorisée (pour `/live` et les téléphones), **aucune écriture publique directe** (toutes les mutations passent exclusivement par le serveur).
  - Ajoutée à la publication `supabase_realtime`.
- **Nouvelle route API serveur `/api/tournament/state`** :
  - `GET` : renvoie le snapshot courant et la révision (ou `{ mode: "local_fallback" }` proprement en dev sans clés Supabase).
  - `POST` : vérifie l'origine anti-CSRF (`assertTrustedMutationOrigin`), le rate limiting (`checkServerRateLimit`), valide l'action en **Zod strict**, et applique des **reducers atomiques serveur** (`src/lib/tournament/state-reducers.ts`) avec **concurrence optimiste (3 tentatives)** pour que 2 tables qui valident une donne à la même milliseconde ne s'écrasent jamais !
  - Les actions admin (`admin_replace_state`, `broadcast_special_event`) vérifient obligatoirement `await requireAdmin()`.
- **Hook temps réel `useTournamentStore()`** :
  - S'abonne à Supabase Realtime (`postgres_changes`) + filet de sécurité polling 5 s (uniquement onglet visible) + propagation automatique des pop-ups `/live` entre appareils.
  - Badge de statut temps réel dans `/admin` (`Synchro Multi-Téléphones · Rév. #N` vs `Mode local navigateur`) et dans `/live`.
- **Améliorations sécurité appliquées lors de ma passe critique** :
  - Protection **anti-IDOR** sur `submit_alert` (impossible d'envoyer un abandon/alerte pour une équipe qui ne joue pas sur cette table).
  - Verrouillage serveur `423 Locked` si l'admin a verrouillé la saisie joueurs ou la table, + plafond de 40 donnes par match + sanitisation serveur de tous les textes.
- **Tests ajoutés** : `tests/realtime-sync.test.ts` (24/24 tests verts).
- **Routes à tester** : `/admin`, `/ma-table`, `/live`, `/api/tournament/state`.

---

### Branche 4 : `feat/da-club-editorial` (`6dc9a97`)
**Objectif** : Proposition de direction artistique ultra-épurée et **100 % non-IA**, inspirée des cercles de cartes français et des affiches sérigraphiées ENSEIRB.
- **Identité tactile « Papier Cartonné 280g & Tapis Feutre »** :
  - Trame micro-grain papier discrète en CSS pur (zéro requête externe), géométrie nette (`4px`/`6px` au lieu des grosses bulles SaaS), filets d'encre francs (`2px solid`).
  - Mode sombre calibré pour éviter l'éblouissement (bordures dorées adoucies `#b98524` + accents tapis vert `#14281c`).
- **Hiérarchie de boutons nettement différenciée** :
  - **Primaire (`.btn-primary`)** : estampille typographique ambre avec décalage d'imprimerie net (`3px 3px 0`) qui s'enfonce physiquement au clic (zéro ombre floue IA).
  - **Secondaire (`.btn-secondary`)** : trait d'encre fin sur fond transparent.
  - **Navigation accueil (`.home-nav-ghost`)** : vrais liens éditoriaux soulignés, plus aucun bouton cloné.
- **Feuille de marque `/ma-table` façon carnet de coinche** :
  - En-tête tapis vert, séparateur central net, scores `52px` en `Barlow Condensed` `tabular-nums`.
- **Accueil & Planche-contact 5 photos** :
  - En-tête avec nouveau logo abeilles + enseignes vectorielles `♠ ♥ ♦ ♣`, zéro blabla.
  - Planche-contact numérotée `N°01` à `N°05` mettant en valeur **toutes les vraies photos du club à 100 % non rognées** (grille symétrique 1+2+2 parfaite à 375 px mobile, et 5 colonnes sur desktop).
- **Routes à tester** : `/`, `/ma-table`, `/classement` (en mode clair ET en mode sombre, et en responsive `375 px`).

---

## 2. Comment comparer et fusionner ce matin

### A. Prévisualiser une branche sans rien toucher à `main`
Dans ton terminal :
```bash
# 1. Tester le mode Partie Libre au BAR toute l'année (/jouer)
git checkout feat/partie-libre-annuelle
npm run dev

# 2. Tester la Boîte à Memes communautaire (/memes) & Soundboard multi-MP3
git checkout feat/banque-memes-communaute
npm run dev

# 3. Tester la synchro multi-téléphones Supabase Realtime (/api/tournament/state)
git checkout feat/synchro-supabase-realtime
npm run dev

# 4. Tester la refonte visuelle Club Éditorial (100 % non-IA)
git checkout feat/da-club-editorial
npm run dev
```
*(Si Next.js garde un vieux cache de routes entre deux branches, fais juste `rm -rf .next` avant `npm run dev`.)*

### B. Fusionner les branches que tu aimes dans `main`
Si tu veux **tout combiner** dans `main`, voici l'ordre le plus propre pour minimiser les conflits (principalement 2-3 lignes dans `HomeView.tsx` et `AdminPosterAndKnockoutPanel.tsx`) :
```bash
git checkout main

git merge feat/synchro-supabase-realtime
git merge feat/partie-libre-annuelle
git merge feat/banque-memes-communaute
git merge feat/da-club-editorial

rm -rf .next && npm run verify
```
Puis quand tout est vert et te plaît :
```bash
git push origin main
```

---

## 3. Mes réflexions critiques & pistes pour la suite (Sécurité, Design, Produit)

### Sécurité & Production Vercel (prioritaire avant le prochain gros tournoi)
1. **Stockage distant des photos / memes (Supabase Storage)** :
   - Sur `feat/banque-memes-communaute`, les memes uploadés et MP3 sont compressés en local (parfait en démo et sur l'ordi du projecteur). Pour que les memes envoyés depuis le téléphone d'un étudiant apparaissent sur le vidéoprojecteur en prod Vercel, la prochaine étape logique est de créer un bucket **Supabase Storage** `coincheirb-media` (lecture publique, écriture via `/api/memes` avec validation magic bytes côté serveur + quota 2 Mo).
2. **Protection anti-troll entre tables en mode multi-téléphones** :
   - En soirée étudiante, un joueur pourrait ouvrir la table d'un pote et changer son score pour rire. Piste simple sans casser l'UX rapide : générer un **code table court à 3 chiffres** (ou un verrou « 1er téléphone qui ouvre la table devient marqueur officiel » avec bouton admin « Libérer le téléphone marqueur »).
3. **Historique d'audit & bouton « Annuler dernière donne »** :
   - Garder dans `/admin` un journal horodaté des 20 dernières modifications de score avec un bouton `Annuler` en 1 clic si une table se trompe en phase finale.
4. **Checklist Vercel + Supabase à activer au déploiement** :
   - Exécuter les **2 migrations** SQL dans l'éditeur SQL Supabase (`202611250001_coincheirb_schema.sql` puis `202611250002_tournament_live_state.sql`).
   - Renseigner dans Vercel Environment Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_HMAC_SECRET` (64 caractères aléatoires), `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (généré en `scrypt`), `NEXT_PUBLIC_SITE_URL`.

### Design & Identité visuelle
1. **QR Code géant sur la vue `/live` avant 18h30** :
   - Afficher un QR code net directement à côté de l'affiche sur `/live` pour que les joueurs scannent l'écran en arrivant au BAR et tombent direct sur le champ « Tape ton prénom ».
2. **Nouvelle photo repérée dans `public/assets/`** :
   - J'ai vu une nouvelle photo `photo_2026-11-25 11.15.16 PM.jpeg` dans `public/assets/` (je l'ai laissée intacte sans y toucher). Si tu veux l'intégrer dans la planche-contact ou la banque de memes, dis-moi sa légende et sa catégorie !
3. **Mode « Thème d'affiche » personnalisable** :
   - Permettre à l'admin de choisir parmi 3 palettes préréglées selon la soirée (Ambre classique, Gala Bordeaux/Or, Printemps Tapis Vert) tout en gardant la lisibilité WCAG intacte.

### Produit & Expérience BAR toute l'année
1. **Bouton « Revanche / Inverser les partenaires » sur `/jouer`** :
   - En fin de partie libre au BAR, relancer en 1 clic avec les mêmes 4 prénoms (mêmes équipes ou partenaires croisés).
2. **Carte Story Instagram PNG (1080×1920) générée en 1 clic** :
   - Dans `/classement` (onglet Fin de soirée), un bouton « Télécharger Story Insta » qui compose la photo des vainqueurs + le score de la finale + le nombre de Capots/Générales/Coinches de la soirée, prêt à publier sur les réseaux du club.
3. **PWA installable (`manifest.webmanifest`)** :
   - Pour ajouter l'icône abeilles Coinch'Eirb sur l'écran d'accueil iPhone/Android et survivre aux micro-coupures Wi-Fi au BAR.
