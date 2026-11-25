import "server-only";
import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST_N = 16384;
const SCRYPT_BLOCK_R = 8;
const SCRYPT_PARALLEL_P = 1;

// Alphabet sans caracteres ambigus (pas de 0, O, 1, I, L) pour saisie rapide a 18h30
const ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Genere un code court d'acces equipe cryptographiquement aleatoire (6 caracteres par defaut).
 */
export function generateTeamAccessCode(length: number = 6): string {
  const chars: string[] = [];
  for (let i = 0; i < length; i += 1) {
    const idx = crypto.randomInt(0, ACCESS_CODE_ALPHABET.length);
    const char = ACCESS_CODE_ALPHABET[idx];
    if (char !== undefined) {
      chars.push(char);
    }
  }
  return chars.join("");
}

/**
 * Normalise un code court saisi sur telephone (majuscules, sans espaces ni tirets).
 */
export function normalizeAccessCode(rawCode: string): string {
  return rawCode.toUpperCase().replace(/[\s-]+/g, "").trim();
}

/**
 * Hache un mot de passe ou un code d'acces cote serveur avec `crypto.scrypt` et un sel aleatoire 128 bits.
 */
export async function hashSecret(plainSecret: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      plainSecret,
      salt,
      SCRYPT_KEYLEN,
      {
        N: SCRYPT_COST_N,
        r: SCRYPT_BLOCK_R,
        p: SCRYPT_PARALLEL_P,
      },
      (err, key) => {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve(key);
      },
    );
  });

  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

/**
 * Verifie un mot de passe ou un code d'acces en temps constant (`timingSafeEqual`).
 */
export async function verifySecret(
  plainSecret: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = parts[1];
  const expectedHex = parts[2];
  if (salt === undefined || expectedHex === undefined) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHex, "hex");
  if (expectedBuffer.byteLength !== SCRYPT_KEYLEN) {
    return false;
  }

  const candidateBuffer = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      plainSecret,
      salt,
      SCRYPT_KEYLEN,
      {
        N: SCRYPT_COST_N,
        r: SCRYPT_BLOCK_R,
        p: SCRYPT_PARALLEL_P,
      },
      (err, key) => {
        if (err !== null) {
          reject(err);
          return;
        }
        resolve(key);
      },
    );
  });

  if (candidateBuffer.byteLength !== expectedBuffer.byteLength) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}
