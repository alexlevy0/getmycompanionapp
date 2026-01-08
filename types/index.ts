// ============================================
// Re-export types from Zod schemas (Single Source of Truth)
// ============================================

export type {
  UserStatus,
  UserMetadata,
  DiplerWebhookPayload,
} from "@/lib/schemas";

// ============================================
// Additional Types (not derived from schemas)
// ============================================

export type Persona = string;

export type CallStatus = "completed" | "no_answer" | "failed";

// ============================================
// Dipler Extraction Types
// ============================================

/**
 * Extraction data from Dipler's post-conversation analysis.
 * Used for preference updates during onboarding and regular calls.
 */
export interface DiplerExtraction {
  user_name?: string;
  preferred_time?: string;
  preferred_days?: string;
  goals?: string;
}

/**
 * Post-conversation analysis provided by Dipler after call completion.
 */
export interface DiplerPostConversationAnalysis {
  summary?: string;
  sentiment?: "positive" | "negative" | "neutral";
  extraction?: DiplerExtraction;
}

/**
 * Conversation stats from Dipler.
 */
export interface DiplerConversationStats {
  callDurationSeconds: number;
  messageCount: number;
}

/**
 * Conversation object from Dipler webhook.
 */
export interface DiplerConversation {
  id: string;
  stats: DiplerConversationStats;
  postConversationAnalysis?: DiplerPostConversationAnalysis;
}

// ============================================
// Utility Functions
// ============================================

import { z } from "zod";
import { DiplerWebhookSchema } from "@/lib/schemas";

type DiplerPayload = z.infer<typeof DiplerWebhookSchema>;

/**
 * Determines call status from Dipler payload.
 * - no_answer: 0 messages or very short duration
 * - failed: missing conversation data
 * - completed: everything else
 */
export function determineCallStatus(payload: DiplerPayload): CallStatus {
  if (!payload.conversation?.stats) {
    return "failed";
  }

  const { messageCount, callDurationSeconds } = payload.conversation.stats;

  // No messages or very short call = no answer
  if (messageCount === 0 || callDurationSeconds < 10) {
    return "no_answer";
  }

  return "completed";
}
