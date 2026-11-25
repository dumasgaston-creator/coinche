import { z } from "zod";

export const emailPasswordLoginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
});

export const playerRegistrationSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z
    .string()
    .min(10, "Le mot de passe doit contenir au moins 10 caracteres.")
    .max(128),
  displayName: z.string().trim().min(2).max(60),
  schoolYear: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{4}$/)
    .default("2026-2027"),
});

export const teamQuickAccessSchema = z.object({
  tournamentId: z.string().uuid(),
  teamIdentifier: z.string().trim().min(2).max(60),
  accessCode: z.string().trim().min(4).max(16),
});

export const linkPlayerToTeamSchema = z.object({
  tournamentId: z.string().uuid(),
  teamId: z.string().uuid(),
  playerSlot: z.enum(["player_1", "player_2"]),
  accessCode: z.string().trim().min(4).max(16),
});

export const importRegistrationsSchema = z
  .object({
    tournamentId: z.string().uuid(),
    rawText: z.string().max(200_000).optional(),
    googleSheetsUrl: z.string().url().max(500).optional(),
  })
  .refine(
    (val) =>
      (val.rawText !== undefined && val.rawText.trim().length > 0) ||
      (val.googleSheetsUrl !== undefined &&
        val.googleSheetsUrl.trim().length > 0),
    {
      message:
        "Fournissez un contenu CSV/collage ou un lien Google Sheets valide.",
    },
  );

export const matchDealSubmissionSchema = z.object({
  matchId: z.string().uuid(),
  dealNumber: z.number().int().min(1).max(30),
  pointsTeamA: z.number().int().min(0).max(2500),
  pointsTeamB: z.number().int().min(0).max(2500),
  specialAnnouncement: z
    .enum(["capot", "generale", "coinche", "surcoinche"])
    .nullable()
    .optional(),
  announcementOutcome: z
    .enum(["pending", "passed", "failed"])
    .nullable()
    .optional(),
  parlantePenalty: z.boolean().default(false),
});

export const directFinalScoreSchema = z.object({
  matchId: z.string().uuid(),
  scoreTeamA: z.number().int().min(0).max(5000),
  scoreTeamB: z.number().int().min(0).max(5000),
});

export const liveAnnouncementTriggerSchema = z.object({
  matchId: z.string().uuid(),
  announcementType: z.enum(["capot", "generale", "coinche", "surcoinche"]),
  phase: z.enum(["announced", "passed", "failed"]),
  announcementId: z.string().uuid().optional(),
});

export const refereeAlertCreateSchema = z.object({
  matchId: z.string().uuid(),
  alertType: z.enum(["referee_call", "abandon_request"]),
  doubleConfirmed: z.boolean().default(false),
  message: z.string().trim().max(240).optional(),
});
