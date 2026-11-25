import crypto from "node:crypto";

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error(
    'Usage : npm run hash:password -- "VotreMotDePasseSolideMinimum8Caracteres"',
  );
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const derived = crypto.scryptSync(password, salt, 64, {
  N: 16384,
  r: 8,
  p: 1,
});

const hash = `scrypt$${salt}$${derived.toString("hex")}`;

console.log("\n=== Hash scrypt genere pour ADMIN_BOOTSTRAP_PASSWORD_HASH ===\n");
console.log(`ADMIN_BOOTSTRAP_PASSWORD_HASH=${hash}\n`);
console.log(
  "Copiez cette ligne dans votre fichier .env.local ou dans les variables d'environnement Vercel.\n",
);
