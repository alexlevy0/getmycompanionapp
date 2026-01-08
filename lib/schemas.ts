import { z } from "zod";

// ============================================
// Enums
// ============================================

export const UserStatusEnum = z.enum([
  "onboarding",
  "trial",
  "active",
  "paused",
  "churned",
  "awaiting_payment",
]);

// ============================================
// User Schemas
// ============================================

export const UserMetadataSchema = z.object({
  phone: z.string(),
  first_name: z.string().optional(),
  
  preferred_time: z.string().optional(),
  preferred_days: z.string().optional(),
  timezone: z.string().optional(),

  status: UserStatusEnum.default("onboarding"),
  trial_calls_remaining: z.string().optional(),
  
  total_calls: z.string().optional(),
  last_call_date: z.string().optional(),
  
  // Preferences
  goals: z.string().optional(),
  habits_streak: z.string().optional(),
  
  // Scheduling
  next_call_scheduled: z.string().optional(),
  consecutive_no_answer: z.string().optional(),
  
  // Auth
  auth_token_hash: z.string().optional(),
});

export const UserProfileSchema = z.object({
  id: z.string(),
  metadata: UserMetadataSchema,
});

// ============================================
// Webhook Schemas (Dipler)
// ============================================

export const DiplerExtractionSchema = z.object({
  user_name: z.string().optional(),
  preferred_time: z.string().optional(),
  preferred_days: z.string().optional(),
  goals: z.string().optional(),
});

export const DiplerConversationStatsSchema = z.object({
  callDurationSeconds: z.number(),
  messageCount: z.number(),
});

export const DiplerAnalysisSchema = z.object({
  summary: z.string().optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
  extraction: DiplerExtractionSchema.optional(),
});

export const DiplerConversationSchema = z.object({
  id: z.string(),
  stats: DiplerConversationStatsSchema,
  postConversationAnalysis: DiplerAnalysisSchema.optional(),
});

export const DiplerWebhookSchema = z.object({
  conversation: DiplerConversationSchema,
  metadata: z.record(z.string(), z.string().optional()).and(
    z.object({ customerId: z.string() })
  ),
});

// ============================================
// Auth Schemas
// ============================================

export const LoginRequestSchema = z.object({
  email: z.string().email("Email invalide"),
});

// ============================================
// Types (Inferred)
// ============================================

export type UserStatus = z.infer<typeof UserStatusEnum>;
export type UserMetadata = z.infer<typeof UserMetadataSchema>;
export type DiplerWebhookPayload = z.infer<typeof DiplerWebhookSchema>;
