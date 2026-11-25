# Règles de code et d'interface

Portée : `src/**`

- Écris en TypeScript strict sans `any` injustifié.
- Garde une architecture modulaire : une responsabilité claire par fichier et par fonction.
- N'utilise aucun opérateur ternaire (`a ? b : c`). Écris des blocs `if / else` explicites ou des fonctions dédiées.
- Commente la logique métier importante (génération des poules, départage par poule la plus forte, calcul de coinche, contrôles d'accès) sans paraphraser les lignes évidentes.
- Gère explicitement les états de chargement, les messages d'erreur, les confirmations et les cas limites (nombre impair d'équipes, coupure réseau).
- Vérifie que chaque composant mobile reste propre à 375 px de largeur, sans débordement horizontal ni bouton caché.
- Dans tous les textes d'interface : aucun tiret cadratin, aucun emoji comme icône, aucun faux chiffre et aucun slogan générique.
