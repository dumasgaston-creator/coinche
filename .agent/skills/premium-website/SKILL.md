---
name: premium-website
description: Conçoit et affine un site web sur mesure au rendu studio sans esthétique IA générique, avec direction artistique ciblée, animations GSAP maîtrisées, optimisation mobile à 375 px et sécurité production.
---

# Skill : Création de Site Web Premium (No IA)

## 1. Discipline tokens et modèles
- Utilise un effort élevé uniquement pour poser la direction artistique, la page d'accueil (héros inclus) et les animations complexes.
- Utilise un effort moyen ou un modèle rapide pour décliner les pages secondaires, ajuster le CSS et remplir les métadonnées SEO.
- Demande toujours validation de la page d'accueil avant de coder le reste du site.

## 2. Direction artistique avant le code
Avant d'écrire le premier composant, définis explicitement dans un mini style guide :
- **Palette retenue** : une couleur de fond dominante (claire ou sombre assumée), une surface secondaire, une couleur de texte à fort contraste et une seule couleur d'accent réservée aux actions clés.
- **Duo typographique intentionnel** : une police expressive pour les titres et une police lisible pour l'interface. Interdiction d'utiliser Inter, Geist ou Space Grotesk par défaut ; explique le choix retenu.
- **Référence réelle** : si l'utilisateur fournit une charte, une affiche ou un guide de style (type style.design), reprends ses proportions, ses espacements et son rythme sans copier le contenu.
- **Interdits visuels** : dégradés violets ou néons, pastels fades, ombres portées partout, coins arrondis identiques partout, grilles bento génériques, grilles de points ou orbes en fond, icônes étincelles, emojis comme icônes, faux témoignages, faux compteurs et slogans creux (« libérez votre potentiel »).

## 3. Construction progressive
1. **Premier écran fort** : le héros dit immédiatement ce que fait le produit et propose l'action principale sans défilement.
2. **Animations au service du sens (GSAP)** : ajoute des transitions fluides et des micro-interactions ciblées uniquement là où elles renforcent la lecture ou un moment fort. Évite les animations au survol ou au scroll sur chaque bloc.
3. **Motion design lisible** : pour toute séquence animée ou pop-up, vérifie manuellement qu'aucun texte ne chevauche un autre calque et qu'aucun mot n'est coupé sur les bords.
4. **Déclinaison cohérente** : une fois l'accueil validé, décline les autres pages en gardant exactement les mêmes espacements, marges et échelles typographiques.

## 4. Passe mobile 375 px et finition production
Exécute systématiquement cette passe finale sans casser le design validé :
- **Responsive à 375 px** : vérifie chaque page à 375 px de large (zéro scroll horizontal, marges gauche/droite régulières, boutons accessibles au pouce, aucun élément masqué sous un bouton fixe).
- **SEO propre à chaque page** : balise `<title>` sous 60 caractères, `<meta description>` sous 155 caractères, URL propres sans `.html`, `robots.txt`, `sitemap.xml`, image Open Graph et favicons.
- **Sécurité et conformité** : aucune clé privée exposée côté client, validation serveur des formulaires, protection contre les injections et en-têtes HTTP sécurisés.
- **Complétude** : page 404 personnalisée, textes alternatifs sur toutes les images, compression des médias, états de chargement, messages d'erreur et de confirmation, mentions légales, bandeau cookies avec refus possible, mesure d'audience et adresse de contact. Signale explicitement à l'utilisateur tout élément réel manquant plutôt que de l'inventer.
