import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  assertTrustedMutationOrigin,
  buildSafeErrorResponse,
  getHashedRequestClientKey,
} from "@/lib/security/http";
import { checkServerRateLimit } from "@/lib/security/rate-limit";
import {
  MAX_POSTER_SIZE_BYTES,
  validatePosterUpload,
} from "@/lib/security/upload-validator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ADMIN_DEMO_MAX_BYTES = 4 * 1024 * 1024;
const POSTER_STORAGE_BUCKET = "tournament-posters";

/**
 * Endpoint securise d'upload de l'affiche officielle de la soiree Coinch'Eirb.
 * - Verifie le role administrateur cote serveur via `requireAdmin()`
 * - Limite le debit (12 uploads / 5 minutes par client)
 * - Inspecte les magic bytes reels via `validatePosterUpload()` (JPEG, PNG, WebP uniquement, max 4 Mo)
 * - Enregistre dans Supabase Storage si le bucket est configure et met a jour le tournoi cible.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    assertTrustedMutationOrigin(request);
    const bucketKey = getHashedRequestClientKey(request, "admin-poster-upload");
    const rateDecision = await checkServerRateLimit({
      bucketKey,
      maxAttempts: 12,
      windowSeconds: 300,
      blockSeconds: 600,
    });

    if (!rateDecision.allowed) {
      return NextResponse.json(
        {
          error:
            "Trop de tentatives d'envoi d'affiche. Veuillez patienter avant de reessayer.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateDecision.retryAfterSeconds),
          },
        },
      );
    }

    const adminContext = await requireAdmin();

    const formData = await request.formData();
    const rawFile = formData.get("file");
    const rawTournamentId = formData.get("tournamentId");

    if (!(rawFile instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier image valide n'a ete transmis." },
        { status: 400 },
      );
    }

    const arrayBuffer = await rawFile.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let effectiveMaxBytes = ADMIN_DEMO_MAX_BYTES;
    if (MAX_POSTER_SIZE_BYTES < effectiveMaxBytes) {
      effectiveMaxBytes = MAX_POSTER_SIZE_BYTES;
    }

    let validatedFile;
    try {
      validatedFile = validatePosterUpload(
        bytes,
        rawFile.type,
        effectiveMaxBytes,
      );
    } catch (validationError) {
      let message = "Fichier image invalide ou non supporte.";
      if (validationError instanceof Error) {
        message = validationError.message;
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const randomSuffix = crypto.randomBytes(8).toString("hex");
    const storagePath = `posters/${Date.now()}-${randomSuffix}.${validatedFile.extension}`;

    let publicUrl: string | null = null;
    let persistedInDatabase = false;

    try {
      const adminClient = createSupabaseAdminClient();
      const { error: uploadError } = await adminClient.storage
        .from(POSTER_STORAGE_BUCKET)
        .upload(storagePath, bytes, {
          contentType: validatedFile.detectedMimeType,
          upsert: false,
        });

      if (uploadError === null) {
        const urlData = adminClient.storage
          .from(POSTER_STORAGE_BUCKET)
          .getPublicUrl(storagePath);
        publicUrl = urlData.data.publicUrl;

        if (
          typeof rawTournamentId === "string" &&
          /^[0-9a-fA-F-]{36}$/.test(rawTournamentId)
        ) {
          const { error: updateError } = await adminClient
            .from("tournaments")
            .update({
              poster_storage_path: storagePath,
              poster_public_url: publicUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", rawTournamentId);

          if (updateError === null) {
            persistedInDatabase = true;
          }
        }

        let targetIdOrNull: string | null = null;
        if (typeof rawTournamentId === "string") {
          targetIdOrNull = rawTournamentId;
        }

        await adminClient.from("security_audit_logs").insert({
          actor_profile_id: adminContext.userId,
          actor_team_id: null,
          action: "poster_upload",
          target_table: "tournaments",
          target_id: targetIdOrNull,
          ip_hash: bucketKey,
          metadata: {
            mime: validatedFile.detectedMimeType,
            sizeBytes: validatedFile.sizeBytes,
            storagePath,
          },
        });
      }
    } catch {
      persistedInDatabase = false;
    }

    return NextResponse.json(
      {
        uploaded: true,
        persistedInDatabase,
        storagePath,
        publicUrl,
        detectedMimeType: validatedFile.detectedMimeType,
        extension: validatedFile.extension,
        sizeBytes: validatedFile.sizeBytes,
      },
      { status: 200 },
    );
  } catch (error) {
    return buildSafeErrorResponse(error);
  }
}
