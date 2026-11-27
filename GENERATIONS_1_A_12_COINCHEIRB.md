# Journal des 12 Générations d'Amélioration Continue — Coinch'Eirb (`GENERATIONS_1_A_12_COINCHEIRB.md`)

Ce document retrace les **12 générations successives** de conception, de sécurisation, de création audio/UX et de remise en question continue réalisées pour transformer **Coinch'Eirb (ENSEIRB-MATMECA)** en une application de production prête pour GitHub et Vercel.

---

## Liens Cliquables & Accès Rapide

- 🌐 **Lien public à cliquer pour ouvrir le site (Vercel)** : **[https://coincheirb.vercel.app](https://coincheirb.vercel.app)**
- 🏆 **Classements par Équipe & Individuel ENSEIRB** : **[https://coincheirb.vercel.app/classement](https://coincheirb.vercel.app/classement)**
- 🃏 **Partie Libre au BAR & Ajout de Partenaire** : **[https://coincheirb.vercel.app/jouer](https://coincheirb.vercel.app/jouer)**
- 📺 **Grand Écran Vidéoprojecteur (`/live`)** : **[https://coincheirb.vercel.app/live](https://coincheirb.vercel.app/live)**
- 🚀 **Déployer sur Vercel en 1 clic** : **[https://vercel.com/new](https://vercel.com/new)**

---

## Génération 1 — Purge intégrale des Tests & Remise à Zéro (Zéro joueur fictif)

### Réalisations concrètes
1. **Suppression complète des fichiers et scripts de test** :
   - Suppression du dossier `tests/`, de `supabase/tests/` et de `vitest.config.ts`.
   - Nettoyage de [package.json](file:///Users/gast/Desktop/AI/coincheirb/package.json) (`verify` exécute désormais `npm run check:no-ternary && npm run typecheck && npm run build`).
2. **Suppression de tous les boutons de test / simulation dans l'interface** :
   - Retrait des boutons `+ Tester appel arbitre` et `+ Tester abandon table` dans [AdminRefereeAlertsPanel.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/admin/AdminRefereeAlertsPanel.tsx).
   - Retrait du générateur `Tournoi test (N éq.)` dans [AdminControlHeader.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/admin/AdminControlHeader.tsx).
   - Retrait du bouton de simulation factice `Pop-up` dans [LiveTopBar.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/live/LiveTopBar.tsx).
3. **Éradication de tous les joueurs et matchs fictifs (Remise à zéro)** :
   - Suppression des 20 équipes fictives (`SEED_TEAMS_DATA`), des joueurs fictifs (`extraPlayers`) et des donnes simulées dans [live-store-types.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/tournament/live-store-types.ts).
   - Suppression des 20 équipes fictives, 30 matchs de poule fictifs, 15 matchs d'arbre fictifs et 16 joueurs annuels fictifs dans [tournament-data.ts](file:///Users/gast/Desktop/AI/coincheirb/src/components/classement/tournament-data.ts).
   - Suppression des parties libres fictives (`SEED_CASUAL_GAMES`) dans [casual-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/casual/casual-store.ts).
   - Purge automatique au démarrage des anciennes clés `localStorage` (`v1`, `v2`) dans [live-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/tournament/live-store.ts) pour que tout navigateur repart immédiatement à **zéro**.

### Remise en question critique (Fin de Génération 1)
> *« L'application démarre désormais proprement à zéro sans aucun nom fictif ni bouton de test. Mais qu'en est-il de `/admin` ? Si quelqu'un tape `/admin` sur Internet, comment empêcher à 100 % qu'un étudiant ou un bot puisse entrer ou deviner l'accès ? »*

### Prompt auto-généré pour la Génération 2
> **Prompt Génération 2** : *« Audite la route `/admin` et toutes ses portes d'entrée. Supprime tout bouton `/admin` visible sur les pages publiques, supprime définitivement la bannière d'indice de mot de passe de développement, et implémente une authentification multi-facteurs côté serveur (Identifiant Bureau + Mot de passe maître scrypt + Code PIN à 6 chiffres) avec piège Honeypot anti-bot et blocage IP de 30 minutes après 4 échecs. »*

---

## Génération 2 — Forteresse `/admin` Multi-Facteurs & Dissimulation Publique

### Réalisations concrètes
1. **Dissimulation de `/admin` sur l'interface publique** :
   - Retrait du bouton `Admin` dans [AppHeader.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/layout/AppHeader.tsx), [HomeView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/home/HomeView.tsx), [MaTableView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/table/MaTableView.tsx), [ClassementView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/classement/ClassementView.tsx) et [MemeBoxView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/memes/MemeBoxView.tsx).
2. **Suppression totale de l'indice de mot de passe local** :
   - Suppression de `devBootstrapHintAvailable` et `initialDevHintAvailable` dans [src/app/admin/page.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/app/admin/page.tsx), [src/app/api/auth/me/route.ts](file:///Users/gast/Desktop/AI/coincheirb/src/app/api/auth/me/route.ts) et [AdminDashboardClient.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/admin/AdminDashboardClient.tsx). Plus aucun mot de passe n'est jamais affiché ni pré-rempli.
3. **Triple vérification cryptographique côté serveur (`/api/auth/admin/login`)** :
   - Dans [src/app/api/auth/admin/login/route.ts](file:///Users/gast/Desktop/AI/coincheirb/src/app/api/auth/admin/login/route.ts), l'accès exige simultanément :
     1. **L'Identifiant Bureau** (`ADMIN_IDENTIFIER`, comparé en temps constant par SHA-256 + `crypto.timingSafeEqual`),
     2. **Le Mot de passe maître** (`ADMIN_BOOTSTRAP_PASSWORD_HASH`, vérifié par `crypto.scrypt` N=16384 + `timingSafeEqual`),
     3. **Le Code PIN de sécurité à 6 chiffres** (`ADMIN_SECURITY_PIN`, vérifié en temps constant).
   - Ajout d'un champ **Honeypot anti-bot** invisible et d'un **Rate Limiter sévère** (4 tentatives max sur 10 minutes, blocage automatique de 30 minutes).

### Remise en question critique (Fin de Génération 2)
> *« `/admin` est désormais verrouillé par 3 facteurs + rate-limit + honeypot. Mais maintenant que l'appli part de zéro, comment valoriser la compétition à l'ENSEIRB au fur et à mesure que les vrais joueurs s'inscrivent ? Il manque un vrai classement par ÉQUIPE (binômes) en plus du classement individuel pour savoir quelles équipes gagnent le plus à l'ENSEIRB ! »*

### Prompt auto-généré pour la Génération 3
> **Prompt Génération 3** : *« Conçois un moteur algorithmique de double classement temps réel dans `casual-store.ts` et `ClassementView.tsx` : 1) Un Classement par Équipe ENSEIRB qui agrège chaque paire de joueurs `[Joueur A / Joueur B]` (indépendamment de l'ordre de saisie) sur l'ensemble des tournois et des parties au BAR pour classer les équipes qui gagnent le plus à l'ENSEIRB ; 2) Un Classement Individuel complet avec filière, promo, taux de victoire, série et goal-average net `+/-`. »*

---

## Génération 3 — Double Classement ENSEIRB : Classement en Équipe & Classement Individuel

### Réalisations concrètes
1. **Moteur `computeEnseirbTeamLeaderboard()` ([casual-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/casual/casual-store.ts))** :
   - Canonicalisation automatique des paires (`makeCanonicalPairKey` : `"Gaston / Jules"` et `"Jules / Gaston"` alimentent exactement la même équipe).
   - Calcul pour chaque équipe : **Nombre de victoires**, **Taux de victoire (%)**, **Points d'équipe**, **Titres de tournoi gagnés ensemble**, **Goal-Average net (`+/-`)**, **Meilleure série de victoires (`bestWinStreak`)**, **Capots, Générales et Coinches réalisés en duo**.
2. **Moteur `computeCombinedAnnualLeaderboard()` enrichi ([casual-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/casual/casual-store.ts))** :
   - Classement individuel par victoires, points annuels et solde net `+/-`, avec filière ENSEIRB, année de promo, style de jeu, meilleur partenaire et bête noire.
3. **Nouvel onglet prioritaire `Équipes ENSEIRB` dans [ClassementView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/classement/ClassementView.tsx)** :
   - Répond directement à la question : *« Quelles sont les équipes qui gagnent le plus à l'ENSEIRB ? »*.

### Remise en question critique (Fin de Génération 3)
> *« On a le classement individuel et le classement par équipe. Mais quand un joueur est connecté et s'apprête à jouer au BAR ou en tournoi avec quelqu'un, comment peut-il connaître le profil et son historique avec cette personne, et surtout comment peut-il ajouter son partenaire dans l'application même s'il n'est pas cette personne ? »*

### Prompt auto-généré pour la Génération 4
> **Prompt Génération 4** : *« Crée le système d'Annuaire Joueurs ENSEIRB (`SchoolPlayerDirectoryEntry`), le calculateur d'alchimie partenaire (`computePartnerCompatibilityProfile`) et le composant `PartnerDiscoveryAndAddCard.tsx`. Permets à tout joueur connecté de consulter la fiche complète de la personne avec qui il joue (filière, promo, style, victoires ensemble, goal-average en duo, face-à-face) ET d'ajouter un partenaire/joueur dans l'annuaire même s'il n'est pas cette personne, avec création automatique de leur binôme officiel. »*

---

## Génération 4 — « Connaître la personne avec qui on joue » & Ajout de Partenaire par un Membre Connecté

### Réalisations concrètes
1. **Fiche Partenaire & Alchimie Duo (`computePartnerCompatibilityProfile` dans [casual-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/casual/casual-store.ts))** :
   - Affiche instantanément dès qu'on tape ou sélectionne un prénom :
     - Sa **Filière ENSEIRB** (`Informatique`, `Électronique`, `Télécoms`, `Matmeca`, `RSI`) et sa **Promo** (`1A`, `2A`, `3A`, `Alumni`),
     - Son **Style à la table** (`Coincheur agressif`, `Roi du Capot`, `Spécialiste Générale`, `Maître Tout Atout`, etc.) et son **Annonce fétiche**,
     - Votre **Bilan ensemble en binôme** (`Victoires - Défaites ensemble`, `% de réussite en duo`, `Goal-average +/- ensemble`, badge d'alchimie `Duo Dominant` / `Alchimie Positive` / `Nouveau duo à former`),
     - Votre **Face-à-face** quand vous avez joué l'un contre l'autre.
2. **Ajout d'un joueur tiers lorsqu'on est connecté ([PartnerDiscoveryAndAddCard.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/players/PartnerDiscoveryAndAddCard.tsx))** :
   - Dès qu'un étudiant est connecté à son compte Coinch'Eirb, il peut cliquer sur **`+ Ajouter un partenaire / joueur`** pour inscrire la personne avec qui il joue (même s'il n'est pas elle), renseigner sa filière/promo/style, et cocher **« Former aussi notre équipe officielle au classement par équipe ENSEIRB »**.
   - Le joueur ajouté porte le badge **`Ajouté par @pseudo`** et apparaît immédiatement dans l'annuaire, dans `/jouer`, dans `/equipe` et dans `/classement`.

### Remise en question critique (Fin de Génération 4)
> *« La mécanique sociale et les classements Individuel/Équipe sont en place. Maintenant, soyons honnêtes sur la banque de sons : les bips synthétiques Web Audio du début n'avaient aucun impact en soirée ! Il nous faut de VRAIS fichiers audio : le vrai cri viral `FAAAAHHH` converti quand on perd/chute, les vraies voix du Roi Clash Royale qui rigole (`HEHEHEHA`, `HIHIHIHA`) quand on gagne, le Roi qui pleure, le Roi vénère (`GRRRR`), `HOG RIDEEEER` et l'audio réel extrait de la vidéo du club ! »*

### Prompt auto-généré pour la Génération 5
> **Prompt Génération 5** : *« Extrais et convertis la piste audio réelle de `public/assets/media/popup-premiere-donne.mp4` via `afconvert` en `.m4a`, intègre les vrais fichiers audio MP3 dans `public/assets/sounds/` (`clash-king-laugh.mp3`, `clash-king-thumbsup.mp3`, `clash-king-cry.mp3`, `clash-king-grrr.mp3`, `faaaah-lose.mp3`, `auughhh-lose.mp3`, `emotional-damage.mp3`, `hog-rider.mp3`, `vine-boom.mp3`, etc.), refonds `sound-engine.ts` pour jouer ces vrais fichiers par défaut, et déclenche automatiquement le Roi qui rigole quand on gagne et `FAAAAHHH` quand on perd. »*

---

## Génération 5 — Vraie Banque Audio Clash Royale (`HEHEHEHA`) & Cri `FAAAAHHH` + Conversion Vidéo BAR

### Réalisations concrètes
1. **16 vrais fichiers audio MP3 & M4A intégrés dans `public/assets/sounds/`** :
   - `clash-king-laugh.mp3` : **Roi Clash Royale qui rigole (`HEHEHEHA !`)** — joué quand un contrat passe ou qu'on gagne !
   - `clash-king-thumbsup.mp3` : **Roi Clash Royale Victoire (`HIHIHIHA !`)** — joué sur le sacre / victoire finale !
   - `faaaah-lose.mp3` : **Vrai cri viral `FAAAAHHH !`** — joué quand un contrat chute ou qu'une équipe perd !
   - `clash-king-cry.mp3` : **Roi Clash Royale qui pleure (`UH HUH HUH`)**.
   - `clash-king-grrr.mp3` : **Roi Clash Royale vénère (`GRRRR !`)**.
   - `emotional-damage.mp3` : **`EMOTIONAL DAMAGE !`** (surcoinche chutée).
   - `auughhh-lose.mp3` : **`AUUGHHH !`**.
   - `hog-rider.mp3` : **Clash Royale `HOG RIDEEEER !`** (annonces Coinche / Capot / Générale).
   - `vine-boom.mp3` : **Vrai `Vine Boom`** sub-bass.
   - `club-premiere-donne.m4a` : **Extrait audio réel converti via `/usr/bin/afconvert`** depuis la vidéo `popup-premiere-donne.mp4` du club Coinch'Eirb !
   - Plus `mlg-airhorn.mp3`, `sad-trombone.mp3`, `bruh.mp3`, `siren-coinche.mp3`.
2. **Déclenchement automatique sur Victoire / Défaite ([sound-engine.ts](file:///Users/gast/Desktop/AI/coincheirb/src/components/live/sound-engine.ts), [PartieLibreView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/jouer/PartieLibreView.tsx), [MaTableView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/table/MaTableView.tsx))** :
   - Dès qu'un contrat est marqué **Passé** ou qu'une partie est remportée -> le Roi Clash Royale rigole (`HEHEHEHA !`).
   - Dès qu'un contrat est marqué **Chuté** ou qu'une équipe perd -> le vrai son `FAAAAHHH !` retentit.

### Remise en question critique (Fin de Génération 5)
> *« Les sons sont authentiques et jouent automatiquement. Mais que se passe-t-il si deux étudiants utilisent chacun leur téléphone sur Vercel pour ajouter un partenaire dans l'annuaire ou enregistrer une partie au BAR ? Si tout reste uniquement dans le `localStorage` d'un seul téléphone, l'autre téléphone ne verra pas immédiatement le nouveau partenaire ajouté ! »*

### Prompt auto-généré pour la Génération 6
> **Prompt Génération 6** : *« Crée une route API serveur sécurisée `/api/casual/sync` protégée par vérification d'origine anti-CSRF, rate limiting, validation Zod stricte et vérification du cookie de session compte joueur (`getClubAccountFromCookie`) lors de l'ajout d'un joueur tiers, puis connecte `casual-store.ts` et `use-casual-store.ts` à cette API. »*

---

## Génération 6 — Synchronisation Serveur Multi-Téléphones de l'Annuaire & des Parties (`/api/casual/sync`)

### Réalisations concrètes
1. **Endpoint serveur [src/app/api/casual/sync/route.ts](file:///Users/gast/Desktop/AI/coincheirb/src/app/api/casual/sync/route.ts)** :
   - `GET /api/casual/sync` : renvoie l'annuaire des joueurs ENSEIRB et les parties enregistrées avec `Cache-Control: no-store`.
   - `POST /api/casual/sync` :
     - Vérifie l'en-tête `Origin` anti-CSRF (`assertTrustedMutationOrigin`),
     - Applique le rate-limiting serveur (`60 req / min`),
     - Valide chaque champ via un schéma **Zod** strict (`directoryEntrySchema`, `casualGameSchema`),
     - Exige un cookie `coincheirb_club_account` signé valide (`getClubAccountFromCookie()`) pour l'action `upsert_player`, garantissant côté serveur que seul un utilisateur véritablement connecté peut ajouter un partenaire dans l'annuaire partagé !
2. **Synchronisation transparente dans [casual-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/casual/casual-store.ts) et [use-casual-store.ts](file:///Users/gast/Desktop/AI/coincheirb/src/lib/casual/use-casual-store.ts)**.

### Remise en question critique (Fin de Génération 6)
> *« On a la vraie banque audio Clash Royale / FAAAAHHH et la synchro serveur. Mais comment rendre l'expérience au BAR encore plus vivante entre les tables et le vidéoprojecteur `/live` ? Et si les joueurs pouvaient disposer d'une barre d'Emotes Sonores Clash Royale sur `/jouer`, `/ma-table`, `/classement` et `/memes`, avec une option pour projeter leur Emote + Son directement sur le grand écran `/live` ? »*

### Prompt auto-généré pour la Génération 7
> **Prompt Génération 7** : *« Crée le composant `ClashRoyaleSoundboardBar.tsx` offrant un accès direct aux boutons `Roi HEHEHEHA !`, `Roi HIHIHIHA !`, `FAAAAHHH !`, `Roi qui pleure`, `Roi GRRRR !`, `Emotional Damage`, `HOG RIDEEEER !`, `Vine Boom`, avec un commutateur `Pop-up /live : ON/OFF` permettant de diffuser l'emote en temps réel sur le vidéoprojecteur `/live`. »*

---

## Génération 7 — Soundboard Emotes Clash Royale & Diffusion Directe vers `/live`

### Réalisations concrètes
1. **Composant [ClashRoyaleSoundboardBar.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/live/ClashRoyaleSoundboardBar.tsx)** :
   - Intégré sur `/jouer`, `/ma-table`, `/classement` et `/memes`.
   - Permet de déclencher à tout moment les vrais sons MP3 (`Roi HEHEHEHA !`, `Roi HIHIHIHA !`, `FAAAAHHH !`, `Roi qui pleure`, `Roi GRRRR !`, `Emotional Damage`, `HOG RIDEEEER !`, `Vine Boom`).
   - Bouton **`Pop-up /live : ON/OFF`** relié à `broadcastSpecialLiveEventFromStore` pour envoyer l'emote et son cri en direct sur le vidéoprojecteur du BAR !

### Remise en question critique (Fin de Génération 7)
> *« Regardons maintenant l'onglet `Équipes ENSEIRB` dans `/classement`. Quand plusieurs binômes commencent à jouer, comment mettre en valeur les équipes qui dominent vraiment l'ENSEIRB et permettre aux autres binômes de les défier en 1 clic au BAR ? »*

### Prompt auto-généré pour la Génération 8
> **Prompt Génération 8** : *« Ajoute en haut de l'onglet `Équipes ENSEIRB` dans `ClassementView.tsx` un Podium Visuel Or / Argent / Bronze des 3 équipes qui gagnent le plus à l'ENSEIRB, et ajoute sur chaque carte d'équipe un bouton `Défier ce duo au BAR` qui ouvre `/jouer?adv1=...&adv2=...` en pré-remplissant automatiquement les deux adversaires. »*

---

## Génération 8 — Podium « Top 3 des Équipes ENSEIRB » & Bouton « Défier ce duo au BAR »

### Réalisations concrètes
1. **Podium Or / Argent / Bronze des Meilleures Équipes ENSEIRB ([ClassementView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/classement/ClassementView.tsx))** :
   - Met en avant les 3 binômes ayant le plus de victoires à l'ENSEIRB (`1re Équipe ENSEIRB · Or`, `2e · Argent`, `3e · Bronze`) avec leur surnom, leur taux de victoire `%`, leur solde net `+/-` et leurs points d'équipe.
2. **Défi instantané en 1 clic (`Défier ce duo au BAR`)** :
   - Chaque équipe du classement possède un bouton **`Défier ce duo au BAR`** qui redirige vers `/jouer?adv1=Joueur1&adv2=Joueur2`.
   - [PartieLibreView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/jouer/PartieLibreView.tsx) lit automatiquement `?adv1=` et `?adv2=` (ainsi que `?partenaire=`) et pré-remplit la table de match !

### Remise en question critique (Fin de Génération 8)
> *« Remettons notre casquette d'expert cybersécurité : le site va être hébergé publiquement sur GitHub et Vercel. Que se passe-t-il si un attaquant n'utilise pas l'interface graphique mais envoie directement des requêtes HTTP vers `/api/admin/control` ou `/api/admin/poster`, ou tente d'intégrer le site dans une iframe malveillante ? »*

### Prompt auto-généré pour la Génération 9
> **Prompt Génération 9** : *« Ajoute un pare-feu Edge directement dans `src/middleware.ts` qui bloque toute requête vers `/api/admin/*` dépourvue d'un cookie de session administrateur avant même l'exécution de la route API. Renforce également les en-têtes HTTP de sécurité dans `next.config.ts` (`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, `X-DNS-Prefetch-Control`, `CSP` sans `unsafe-eval` en prod, `HSTS`). »*

---

## Génération 9 — Pare-feu Edge Middleware `/api/admin/*` & Durcissement HTTP Production

### Réalisations concrètes
1. **Pare-feu Edge dans [src/middleware.ts](file:///Users/gast/Desktop/AI/coincheirb/src/middleware.ts)** :
   - Toute requête ciblant `/api/admin/*` est inspectée au niveau du Middleware Edge Next.js : en l'absence du cookie `httpOnly` `coincheirb_admin_session`, elle est immédiatement rejetée avec un statut `401 Unauthorized` et `Cache-Control: no-store`.
   - Redirection HTTPS `308 Permanent Redirect` forcée en production.
2. **En-têtes de sécurité complets dans [next.config.ts](file:///Users/gast/Desktop/AI/coincheirb/next.config.ts)** :
   - `Content-Security-Policy` stricte (interdiction de `'unsafe-eval'` en production, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`),
   - `X-Frame-Options: DENY`,
   - `X-Content-Type-Options: nosniff`,
   - `Referrer-Policy: strict-origin-when-cross-origin`,
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
   - `Cross-Origin-Opener-Policy: same-origin`,
   - `Cross-Origin-Resource-Policy: same-origin`,
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.

### Remise en question critique (Fin de Génération 9)
> *« Le site est blindé côté sécurité. Mais comment faire pour que n'importe quel étudiant au BAR puisse rejoindre le site en 2 secondes sans devoir taper une URL compliquée, ou qu'un joueur connecté puisse envoyer un lien direct "Viens jouer avec moi" sur WhatsApp ? »*

### Prompt auto-généré pour la Génération 10
> **Prompt Génération 10** : *« Crée le composant `ShareWebsiteBanner.tsx` affichant le lien cliquable officiel du site, un bouton "Copier le lien du site", un bouton "Copier lien Jouer avec moi" (`/jouer?partenaire=TonPrenom`), un bouton de partage direct WhatsApp et un QR Code vectoriel SVG scannable en salle, puis intègre-le sur l'accueil `/`, sur `/jouer` et sur `/classement`. »*

---

## Génération 10 — Lien Cliquable Universel, Invitation Partenaire WhatsApp & QR Code BAR

### Réalisations concrètes
1. **Composant [ShareWebsiteBanner.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/layout/ShareWebsiteBanner.tsx)** :
   - Détecte automatiquement l'URL de production (`NEXT_PUBLIC_SITE_URL` ou `window.location.origin`, par défaut `https://coincheirb.vercel.app`).
   - Affiche un **lien cliquable direct**, un bouton **Copier le lien du site**, un bouton **Partager WhatsApp** pré-formaté, un bouton **Copier lien « Jouer avec moi »** (`/jouer?partenaire=TonPrenom` quand on est connecté) et un **QR Code vectoriel SVG** scannable au BAR.
   - Intégré sur [HomeView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/home/HomeView.tsx), [PartieLibreView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/jouer/PartieLibreView.tsx) et [ClassementView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/classement/ClassementView.tsx).

### Remise en question critique (Fin de Génération 10)
> *« Les étudiants peuvent partager le site et créer leurs équipes en 1 clic. Mais comment le Bureau Coinch'Eirb peut-il exporter à tout moment le Classement par Équipe ENSEIRB et le Classement Individuel vers Excel / Google Sheets pour les bilans du club ? »*

### Prompt auto-généré pour la Génération 11
> **Prompt Génération 11** : *« Ajoute dans `ClassementView.tsx` un exporteur CSV UTF-8 avec BOM (`handleExportEnseirbLeaderboardsCsv`) qui génère en 1 clic le fichier `classements-equipes-et-individuel-enseirb.csv` regroupant l'intégralité du Classement par Équipe ENSEIRB (victoires, %, points, goal-average, titres, séries) et du Classement Individuel ENSEIRB. »*

---

## Génération 11 — Export CSV Officiel des Classements par Équipe & Individuel ENSEIRB

### Réalisations concrètes
1. **Exporteur CSV dédié dans [ClassementView.tsx](file:///Users/gast/Desktop/AI/coincheirb/src/components/classement/ClassementView.tsx)** :
   - Bouton **`Exporter Équipes & Individuel (CSV)`** directement dans l'en-tête de l'onglet `Équipes ENSEIRB`.
   - Génère instantanément un fichier CSV encodé en UTF-8 avec BOM (`\uFEFF`) directement lisible dans Excel et Google Sheets avec toutes les statistiques des binômes et des joueurs individuels.

### Remise en question critique (Fin de Génération 11)
> *« Toutes les fonctionnalités demandées sont codées. Pour la 12e et dernière génération, vérifions que le dépôt est 100 % prêt pour un `git push` vers GitHub et un déploiement Vercel sans aucune erreur de build TypeScript, zéro opérateur ternaire, permissions de fichiers propres (`chmod 644`) sur tous les assets audio et images, `vercel.json` et `.env.example` complets. »*

### Prompt auto-généré pour la Génération 12
> **Prompt Génération 12** : *« Crée `vercel.json`, mets à jour `.env.example` et `README.md` avec toute la procédure de déploiement sécurisé GitHub + Vercel et les liens cliquables, vérifie les permissions de tous les fichiers dans `public/assets/`, et exécute `npm run verify` (`check:no-ternary`, `typecheck`, `next build`) pour valider le build de production complet. »*

---

## Génération 12 — Configuration Production GitHub + Vercel & Validation Finale (`npm run verify`)

### Réalisations concrètes
1. **Fichier [vercel.json](file:///Users/gast/Desktop/AI/coincheirb/vercel.json)** et **[.env.example](file:///Users/gast/Desktop/AI/coincheirb/.env.example)** prêts pour Vercel.
2. **Guide de déploiement & Liens cliquables dans [README.md](file:///Users/gast/Desktop/AI/coincheirb/README.md)**.
3. **Normalisation des permissions UNIX (`chmod -R a+r public/assets`)** sur toutes les photos, vidéos et les 16 fichiers audio de `public/assets/sounds/`.
4. **Validation complète par `npm run verify`** :
   - `npm run check:no-ternary` : **0 opérateur ternaire** dans tout `src/`.
   - `npm run typecheck` : **0 erreur TypeScript strict**.
   - `npm run build` : **Build Next.js 15 de production réussi à 100 %**.
