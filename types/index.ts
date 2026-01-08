// ============================================
// User & Status Types
// ============================================

export type UserStatus = "onboarding" | "trial" | "active" | "paused" | "churned" | "awaiting_payment";
export type Persona = string;

export interface UserMetadata {
  phone: string;
  first_name?: string;

  preferred_time: string;
  preferred_days: string;
  timezone: string;

  status: UserStatus;
  trial_calls_remaining: string;

  total_calls: string;
  last_call_date?: string;
  last_call_summary?: string;

  // Preferences
  goals?: string;
  habits_streak?: string;
  family_contact_phone?: string;
  family_contact_name?: string;

  // Scheduling
  next_call_scheduled?: string;
  qstash_message_id?: string;
  consecutive_no_answer: string;
}

// ============================================
// Dipler Webhook Payload (V1 Reference Structure)
// ============================================

/**
 * Extraction data from Dipler's post-conversation analysis.
 * The Receptionist agent populates these fields during onboarding.
 */
export interface DiplerExtraction {
  user_name?: string;
  preferred_time?: string;
  preferred_days?: string;
  goals?: string;
}

/**
 * Post-conversation analysis provided by Dipler after call completion.
 * May be missing if call failed or was too short.
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

/**
 * Metadata passed to Dipler during triggerDiplerCall.
 * Returned in the webhook payload.
 */
export interface DiplerWebhookMetadata {
  customerId: string;
  isFirstCall?: string; // "true" or "false" as string
  [key: string]: string | undefined;
}

/**
 * Full Dipler webhook payload structure (V1 Reference).
 */
export interface DiplerWebhookPayload {
  conversation: DiplerConversation;
  metadata: DiplerWebhookMetadata;
}

// ============================================
// Call Status (derived from payload analysis)
// ============================================

export type CallStatus = "completed" | "no_answer" | "failed";

/**
 * Determines call status from Dipler payload.
 * - no_answer: 0 messages or very short duration
 * - failed: missing conversation data
 * - completed: everything else
 */
export function determineCallStatus(payload: DiplerWebhookPayload): CallStatus {
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
