# GEMINI.md : Projet Coinch'Eirb (Tournoi Temps Réel)

## 1. Mission du projet
Application web temps réel de gestion de tournois de coinche pour l'association étudiante Coinch'Eirb (ENSEIRB-MATMECA).
Capacité cible : 40 à 100 utilisateurs simultanés (joueurs sur téléphone, administrateur sur ordinateur, affichage sur vidéoprojecteur). Déploiement prévu sur Vercel avec base temps réel gratuite (Supabase recommandé).

## 2. Gestion stricte des modèles, des sessions et des tokens
Tu dois protéger le quota de tokens du début à la fin du projet :
- **Modèle lourd (effort élevé)** : réservé à une session courte et ciblée pour l'architecture initiale, la base de données temps réel et ses politiques RLS, l'algorithme de génération des poules et les animations GSAP du vidéoprojecteur.
- **Modèle rapide ou intermédiaire (effort moyen)** : obligatoire pour tout le reste (composants, pages, formulaires, styles CSS, ajustements et corrections ciblées). N'utilise jamais l'effort maximal sur des tâches simples.
- **Passation manuelle de modèle et nouvelle session** : comme la délégation entre modèles n'est pas garantie automatiquement dans l'interface, arrête-toi à la fin de chaque étape validée. Indique-moi explicitement quel modèle sélectionner dans le sélecteur pour la suite et rappelle-moi d'ouvrir une nouvelle conversation afin de ne pas renvoyer tout l'historique à chaque message.
- **Lecture minimale et `/spawn`** : lis uniquement les fichiers directement utiles à la tâche en cours sans parcourir tout le dépôt. Reste en agent unique sur les Étapes 1, 2 et 4, et lance `/spawn` uniquement à l'Étape 3 sur les quatre modules isolés.

## 3. Plan d'exécution en 4 étapes
1. **Étape 1 (Agent unique, modèle lourd en session courte)** : Architecture, schéma Supabase temps réel avec RLS, authentification serveur et moteur algorithmique du tournoi. Stoppe ensuite pour passer sur un modèle plus léger dans une nouvelle session.
2. **Étape 2 (Agent unique, modèle intermédiaire)** : Design system Coinch'Eirb, page d'accueil avec affiche dynamique et écran mobile « Ma table ». Stoppe et demande validation visuelle avant de continuer.
3. **Étape 3 (`/spawn` en 4 sous-agents parallèles, nouvelle session)** :
   - Sous-agent A (modèle lourd) : Vue Vidéoprojecteur (`/live`) avec rotation automatique et pop-ups GSAP.
   - Sous-agent B (modèle intermédiaire) : Dashboard Admin desktop (`/admin`), import Google Sheets et alertes arbitre.
   - Sous-agent C (modèle rapide) : Pages `/regles`, `/equipe` et `/settings`.
   - Sous-agent D (modèle intermédiaire) : Classement général annuel, statistiques de fin de soirée et exports PNG/PDF/CSV.
4. **Étape 4 (Agent unique, nouvelle session)** : Intégration, audit mobile strict à 375 px, audit sécurité et checklist de mise en ligne Vercel.

## 4. Direction artistique Coinch'Eirb (No IA)
- **Palette extraite du logo abeille Coinch'Eirb** (logo présent dans les assets du projet) :
  - Fond sombre chaud (vidéoprojecteur par défaut et thème sombre) : `#161210` / surfaces `#221B17`.
  - Fond clair papier cartonné (mobile par défaut, bascule dans Settings) : `#F7F2E8` / cartes `#FFFDF8`.
  - Accent ambre doré : `#E8A628` (réservé aux actions clés, scores actifs et badges).
  - Accent terre cuite : `#A64622`.
  - Validation / passé : `#2D7D4E`. Critique / abandon / chuté : `#C8342B`.
- **Typographie** : `Barlow Condensed` (titres et scores en `tabular-nums`) et `Plus Jakarta Sans` (interface et corps de texte). Interdiction d'utiliser Inter, Geist ou Space Grotesk.
- **Affiche dynamique** : L'admin peut uploader une nouvelle affiche à chaque soirée. Elle s'affiche sur le héros d'accueil et dans la boucle du vidéoprojecteur avant 18h30.
- **Interdits visuels** : zéro dégradé violet ou néon, zéro ombre portée systématique, zéro grille bento générique, zéro orbe lumineuse, zéro emoji en guise d'icône (icônes vectorielles sobres Lucide + enseignes de cartes SVG), zéro faux chiffre, zéro slogan marketing creux.

## 5. Règles métier du tournoi
- **Import Google Sheets sans clé API IA** : Parseur algorithmique acceptant fichier CSV, copier-coller de colonnes ou lien Google Sheets publié en CSV. Extraction `Nom d'équipe`, `Joueur 1`, `Joueur 2`, détection des doublons, puis liste de check-in avant 18h30.
- **Génération automatique des poules** : Au clic admin « Valider et générer », les inscriptions se figent. Un algorithme déterministe calcule la meilleure répartition pour tout nombre d'équipes (pair ou impair). Pour 20 équipes : 5 poules de 4. Assignation automatique des tables, premier tour à 18h30, rythme libre par table sans chrono bloquant.
- **Format et qualification** :
  - Poules : 5 donnes par match (+ 6e donne en cas d'égalité).
  - Pour 20 équipes : les 3 premiers de chaque poule + le meilleur 4e sortent (16 qualifiés, 4 éliminés). Pas de mini-consolante.
  - Goal-average : nombre total de points marqués.
  - Égalité parfaite : départage automatique en faveur de l'équipe issue de la poule la plus forte (celle ayant cumulé le plus de points).
  - Seuil Huitièmes : au-delà du seuil paramétrable (12 équipes par défaut), passage obligatoire en Huitièmes de finale (jamais directement en Quarts).
  - Scores cibles phase finale : Huitièmes en 500 pts, Quarts en 600 pts, Demies en 700 pts, Finale en 1000 pts.
- **Saisie mobile (1 seul téléphone par table)** :
  - Saisie directe du résultat après chaque donne (pas de preneur à renseigner) + mode Score final direct en cas d'oubli.
  - Modification autorisée pour les équipes, désactivable à tout moment par un bouton admin.
  - Boutons manuels (jamais automatiques) : `Annoncer Capot`, `Annoncer Générale`, `Annoncer Coinche`, `Annoncer Surcoinche`. Chaque clic déclenche un pop-up temps réel sur `/live`. Ensuite, clic manuel `Passé` ou `Chuté` pour envoyer le pop-up de résultat animé sur `/live`.
  - Bouton rouge `Abandon` (double confirmation) et bouton `Appeler un arbitre` reliés en temps réel au dashboard admin.
- **Navigation mobile (5 onglets fixes)** : `Ma table`, `Classement`, `Règles`, `Mon équipe`, `Settings`.
- **Page Règles (contenu officiel)** :
  - Valeurs Tout Atout : Valet 14, 9: 9, As: 6, 10: 5, Roi: 3, Dame: 1, 8/7: 0.
  - Valeurs Sans Atout : As: 19, 10: 10, Roi: 4, Dame: 3, Valet: 2, 9/8/7: 0.
  - Sans annonces (ni tierce ni carré), pas de règle « partenaire ».
  - Contrat passé : preneur marque l'annonce, adversaire 0. Contrat chuté : preneur 0, adversaire 160.
  - Belote : 20 pts, fait baisser le contrat à partir de 100 uniquement, hors points marqués par le preneur.
  - Coinche : double le contrat (ex. 130 passé = 260, chuté = 320). Surcoinche : quadruple.
  - Capot annoncé et fait : 250 pts. Générale annoncée et faite : 500 pts.
  - Parlante : chaque parlante est punie par 160 pts pour l'adversaire.
- **Accès, comptes optionnels et classement annuel** : Accès rapide par pseudo d'équipe ou code court sans compte obligatoire. Compte joueur facultatif pour suivre ses performances et alimenter le classement général Coinch'Eirb sur toute l'année scolaire.
- **Vidéoprojecteur (`/live`)** : Rotation automatique entre poules, meilleurs 4es, matchs en cours, arbre final et affiche de la soirée. File d'attente pour les pop-ups GSAP en temps réel.
- **Dashboard Admin (`/admin`)** : Poste de pilotage sur un écran desktop (tables temps réel, édition forcée des scores, alertes arbitre, forfaits, verrouillage joueur, passage aux 8es, upload d'affiche, statistiques de fin de soirée, exports PNG/PDF/CSV).

## 6. Conventions de code et sécurité non négociables
- **Code** : TypeScript strict, architecture modulaire, fonctions bien commentées, zéro opérateur ternaire.
- **Sécurité** :
  - Aucune clé secrète ni clé `service_role` dans le code client. Variables sensibles uniquement côté serveur.
  - RLS activée et testée sur chaque table.
  - Authentification et rôle Admin vérifiés côté serveur, jamais uniquement dans le navigateur.
  - Protection IDOR : impossible d'accéder aux données d'une autre table ou d'un autre compte via l'URL ou le payload.
  - Mots de passe hachés, cookies de session `httpOnly`, `secure`, `sameSite`.
  - Requêtes paramétrées, validation Zod côté serveur, échappement des entrées utilisateur, réponses API filtrées aux champs nécessaires.
  - Rate limiting sur l'auth et la saisie, validation stricte des uploads d'images (type MIME réel et poids), HTTPS forcé et en-têtes de sécurité (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).

## 7. Checklist obligatoire avant livraison
Vérifie avant de clore : page 404 personnalisée, appel à l'action dès le premier écran, `<title>` (< 60 car.) et `<meta description>` (< 155 car.) sur chaque page, image Open Graph, favicons du logo, `robots.txt`, `sitemap.xml`, attributs `alt`, images compressées, test complet à 375 px, états de chargement, messages d'erreur et de confirmation, mentions légales, bandeau cookies avec refus en un clic, mesure d'audience et contact réel. Signale tout élément réel manquant au lieu de l'inventer.