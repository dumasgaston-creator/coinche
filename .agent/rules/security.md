# Règles de sécurité (non négociables)

Portée : `src/app/api/**`, `src/lib/**`, `supabase/**` et toute route serveur.

- Aucune clé d'API ni secret dans le code envoyé au navigateur. Toutes les variables sensibles restent côté serveur.
- Si Supabase est utilisé, expose uniquement la clé publique `anon` côté client. Interdiction absolue d'utiliser la clé `service_role` dans le navigateur.
- Active et teste la sécurité au niveau des lignes (RLS) sur chaque table de la base de données.
- Vérifie l'authentification et le rôle Admin côté serveur (API routes et Server Actions), jamais uniquement dans le navigateur.
- Empêche tout accès horizontal (IDOR) : vérifie côté serveur qu'un utilisateur a bien le droit de lire ou modifier la table ou le compte visé par l'identifiant reçu.
- Stocke les mots de passe hachés côté serveur et configure les cookies de session en `httpOnly`, `secure` et `sameSite`.
- Utilise uniquement des requêtes paramétrées et valide chaque entrée côté serveur avec Zod.
- Échappe tout contenu saisi par les utilisateurs et limite chaque réponse d'API aux champs strictement nécessaires.
- Ajoute une limitation des tentatives sur la connexion et les saisies sensibles, contrôle strictement les images uploadées (type MIME réel et poids maximal), force le HTTPS et configure les en-têtes de sécurité (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- Si une demande contredit une de ces règles, bloque et préviens l'utilisateur au lieu de contourner.
