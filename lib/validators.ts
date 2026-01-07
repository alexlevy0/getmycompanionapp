import { z } from "zod";
import type { Persona } from "@/types";

// ============================================
// Dipler Webhook Payload Validation
// ============================================

const DiplerExtractionSchema = z.object({
  detected_persona: z.enum(["companion", "coach", "mentor", "friend"]).optional(),
  user_name: z.string().optional(),
  preferred_time: z.string().optional(),
  preferred_days: z.string().optional(),
  goals: z.string().optional(),
}).optional();

const DiplerPostConversationAnalysisSchema = z.object({
  summary: z.string().optional(),
  sentiment: z.enum(["positive", "negative", "neutral"]).optional(),
  extraction: DiplerExtractionSchema,
}).optional();

const DiplerConversationStatsSchema = z.object({
  callDurationSeconds: z.number(),
  messageCount: z.number(),
});

const DiplerConversationSchema = z.object({
  id: z.string(),
  stats: DiplerConversationStatsSchema,
  postConversationAnalysis: DiplerPostConversationAnalysisSchema,
});

const DiplerMetadataSchema = z.object({
  customerId: z.string(),
  isFirstCall: z.string().optional(),
}).passthrough(); // Allow additional properties

export const DiplerWebhookPayloadSchema = z.object({
  conversation: DiplerConversationSchema,
  metadata: DiplerMetadataSchema,
});

export type ValidatedDiplerPayload = z.infer<typeof DiplerWebhookPayloadSchema>;

// ============================================
// Start Trial Request Validation
// ============================================

export const StartTrialRequestSchema = z.object({
  phone: z.string().min(10, "Phone number too short"),
});

export type ValidatedStartTrialRequest = z.infer<typeof StartTrialRequestSchema>;

// ============================================
// Trigger Call Request Validation
// ============================================

export const TriggerCallRequestSchema = z.object({
  phone: z.string(),
  customerId: z.string(),
});

export type ValidatedTriggerCallRequest = z.infer<typeof TriggerCallRequestSchema>;

// ============================================
// Validation Helper
// ============================================

export type ValidationResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

export function validatePayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errorMessage = result.error.errors
    .map((e) => `${e.path.join(".")}: ${e.message}`)
    .join(", ");
  
  return { success: false, error: errorMessage };
}
