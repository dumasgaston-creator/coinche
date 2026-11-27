# Coinch'Eirb — Application Officielle Tournois & Parties au BAR (ENSEIRB-MATMECA)

Application web temps réel du club **Coinch'Eirb (ENSEIRB-MATMECA · Bordeaux INP)** :
- **Démarrage à zéro (0 joueur fictif, 0 test parasite)** : l'application se construit petit à petit uniquement avec vos vrais prénoms et pseudos.
- **Double Classement ENSEIRB** :
  - **Classement par Équipe (`Équipes ENSEIRB`)** : *Quelles sont les équipes qui gagnent le plus à l'ENSEIRB ?* (Victoires en duo, % de réussite, podium Top 3, titres tournoi, série d'invincibilité, goal-average net `+/-`, défi en 1 clic au BAR).
  - **Classement Individuel (`Individuel ENSEIRB`)** : classement personnel cumulé avec tous vos partenaires (Tournois ×3 + Parties au BAR).
- **Connaître la personne avec qui on joue & Ajout Tiers Connecté** : fiche partenaire complète (filière Info/Élec/Télécoms/Matmeca/RSI, promo 1A/2A/3A/Alumni, style de jeu, alchimie en duo, face-à-face) et possibilité d'**ajouter un partenaire dans l'annuaire même si on n'est pas lui/elle** lorsqu'on est connecté !
- **Vraie Banque Audio Clash Royale & Memes (`/assets/sounds/`)** :
  - **Victoire / Contrat passé** : vraie voix du **Roi Clash Royale qui rigole (`HEHEHEHA !` & `HIHIHIHA !`)** + `MLG Airhorn`.
  - **Défaite / Contrat chuté** : vrai cri **`FAAAAHHH !`** converti depuis vidéo + **Roi Clash Royale qui pleure (`UH HUH HUH`)** + **Roi vénère (`GRRRR`)** + `EMOTIONAL DAMAGE` + `AUUGHHH`.
  - **Annonces & Coup d'envoi** : `HOG RIDEEEER !`, vrai `Vine Boom`, `Sirène Coinche` et l'audio réel converti depuis la vidéo `popup-premiere-donne.mp4` du BAR (`club-premiere-donne.m4a`).
- **Forteresse `/admin` sécurisée pour Internet** : aucun bouton `/admin` visible pour le public, aucun mot de passe affiché, **triple authentification serveur** (`Identifiant Bureau` + `Mot de passe maître scrypt` + `Code PIN Bureau à 6 chiffres`), piège Honeypot anti-bot, pare-feu Edge Middleware `/api/admin/*`, blocage anti-bruteforce 30 minutes après 4 échecs, cookies `httpOnly` + `Secure` + `SameSite=Strict` signés en `HMAC-SHA256`.

---

## Liens Cliquables pour accéder au site et le déployer

- **Lien direct vers le site (une fois déployé sur Vercel)** :  
  👉 **[https://coincheirb.vercel.app](https://coincheirb.vercel.app)**
- **Lien direct vers les Classements Équipes & Individuel ENSEIRB** :  
  👉 **[https://coincheirb.vercel.app/classement](https://coincheirb.vercel.app/classement)**
- **Lien direct pour lancer une Partie au BAR & Ajouter son partenaire** :  
  👉 **[https://coincheirb.vercel.app/jouer](https://coincheirb.vercel.app/jouer)**
- **Déployer en 1 clic sur Vercel depuis votre dépôt GitHub** :  
  👉 **[Déployer Coinch'Eirb sur Vercel](https://vercel.com/new)**

*(Dans l'application, un bandeau interactif **« Inviter n'importe qui sur Coinch'Eirb »** génère automatiquement le lien cliquable de votre domaine, un bouton de partage WhatsApp en 1 clic et un QR Code scannable au BAR !)*

---

## Mise en ligne GitHub + Vercel (3 minutes, 100 % sécurisé)

### 1. Pousser sur GitHub
```bash
git add -A
git commit -m "feat: remise a zero, securite multi-facteurs /admin, classements equipe/individuel, ajout partenaire et sons Clash Royale/FAAAAHHH"
git push origin main
```

### 2. Importer dans Vercel
1. Allez sur **[https://vercel.com/new](https://vercel.com/new)** et sélectionnez votre dépôt GitHub `coincheirb`.
2. Dans **Environment Variables** sur Vercel, configurez vos secrets serveur :
   - `SESSION_HMAC_SECRET` : une chaîne aléatoire de 64 caractères (ex. générée avec `openssl rand -hex 32`).
   - `ADMIN_IDENTIFIER` : votre identifiant secret Bureau (par défaut : `bureau-coincheirb`).
   - `ADMIN_SECURITY_PIN` : votre code PIN secret à 6 chiffres (par défaut : `331830`).
   - `ADMIN_BOOTSTRAP_PASSWORD_HASH` : l'empreinte `scrypt` de votre mot de passe maître générée avec :
     ```bash
     npm run hash:password -- "VotreNouveauMotDePasseTresFort!"
     ```
   - `NEXT_PUBLIC_SITE_URL` : l'URL de votre site Vercel (ex. `https://coincheirb.vercel.app`).
3. Cliquez sur **Deploy** : le site est en ligne et protégé !

---

## Journal complet des 12 Générations d'Amélioration Continue

Consultez le fichier **[GENERATIONS_1_A_12_COINCHEIRB.md](file:///Users/gast/Desktop/AI/coincheirb/GENERATIONS_1_A_12_COINCHEIRB.md)** pour lire l'intégralité des 12 générations d'auto-critique, les 12 prompts successifs auto-générés, les créations audio/produit et toutes les couches de sécurité mises en place.
