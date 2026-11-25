import "server-only";

export const MAX_POSTER_SIZE_BYTES = 5 * 1024 * 1024;

export type AllowedPosterMimeType = "image/png" | "image/jpeg" | "image/webp";

export interface ValidatedPosterFile {
  detectedMimeType: AllowedPosterMimeType;
  extension: "png" | "jpg" | "webp";
  sizeBytes: number;
}

/**
 * Inspecte les octets magiques reels d'un binaire pour identifier son vrai type MIME
 * sans jamais faire confiance a `File.type` ni a l'extension envoyee par le client.
 * Le format SVG est volontairement exclu pour eliminer tout vecteur XSS stocke.
 */
export function detectPosterMimeFromBytes(
  bytes: Uint8Array,
): { mime: AllowedPosterMimeType; ext: "png" | "jpg" | "webp" } | null {
  if (bytes.byteLength < 12) {
    return null;
  }

  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;

  if (isPng) {
    return { mime: "image/png", ext: "png" };
  }

  const isJpeg =
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  if (isJpeg) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (isWebp) {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

/**
 * Valide strictement le poids et le type binaire reel d'une affiche uploadee par l'administrateur.
 */
export function validatePosterUpload(
  bytes: Uint8Array,
  declaredMimeType: string,
  maxBytes: number = MAX_POSTER_SIZE_BYTES,
): ValidatedPosterFile {
  if (bytes.byteLength === 0) {
    throw new Error("Le fichier image est vide.");
  }

  if (bytes.byteLength > maxBytes) {
    throw new Error("L'affiche depasse le poids maximal autorise de 5 Mo.");
  }

  const detected = detectPosterMimeFromBytes(bytes);
  if (detected === null) {
    throw new Error(
      "Format d'image non autorise. Seuls les fichiers PNG, JPEG et WebP valides sont acceptes.",
    );
  }

  if (
    declaredMimeType.trim() !== "" &&
    declaredMimeType !== detected.mime
  ) {
    throw new Error(
      "Le type MIME declare ne correspond pas au contenu binaire reel du fichier.",
    );
  }

  return {
    detectedMimeType: detected.mime,
    extension: detected.ext,
    sizeBytes: bytes.byteLength,
  };
}
