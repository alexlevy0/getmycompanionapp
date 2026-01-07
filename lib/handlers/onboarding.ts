import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { scheduleNextCall } from "@/lib/qstash";
import { sendPaymentSMS } from "@/lib/twilio";
import { calculateNextCallTime } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import type { DiplerWebhookPayload, Persona } from "@/types";
import { PERSONAS } from "@/constants/personas";

const log = createScopedLogger("onboarding");

// ============================================
// Onboarding Handler (Receptionist Call Completed)
// ============================================

interface OnboardingResult {
  persona: Persona;
  firstName?: string;
  preferredTime: string;
  preferredDays: string;
  goals?: string;
}

/**
 * Processes the Receptionist agent's call and extracts user preferences.
 * Returns the determined persona and preferences.
 */
export function processOnboarding(payload: DiplerWebhookPayload): OnboardingResult {
  const extraction = payload.conversation?.postConversationAnalysis?.extraction;
  const summary = payload.conversation?.postConversationAnalysis?.summary?.toLowerCase() || "";

  // Determine persona
  let persona: Persona = "friend"; // Default

  if (extraction?.detected_persona && PERSONAS[extraction.detected_persona]) {
    persona = extraction.detected_persona;
    log.info("Persona detected from extraction", { persona });
  } else {
    // Fallback: parse from summary
    persona = detectPersonaFromSummary(summary);
    log.info("Persona inferred from summary", { persona });
  }

  const personaConfig = PERSONAS[persona];

  return {
    persona,
    firstName: extraction?.user_name,
    preferredTime: extraction?.preferred_time || personaConfig.defaultTime,
    preferredDays: extraction?.preferred_days || personaConfig.defaultDays,
    goals: extraction?.goals,
  };
}

/**
 * Detects persona from call summary using keyword matching.
 */
function detectPersonaFromSummary(summary: string): Persona {
  if (summary.includes("coach") || summary.includes("motivation") || summary.includes("sport") || summary.includes("objectif")) {
    return "coach";
  }
  if (summary.includes("mentor") || summary.includes("carrière") || summary.includes("études") || summary.includes("conseil")) {
    return "mentor";
  }
  if (summary.includes("compagnon") || summary.includes("senior") || summary.includes("famille") || summary.includes("solitude")) {
    return "companion";
  }
  return "friend";
}

/**
 * Applies onboarding results to Stripe customer metadata.
 */
export async function applyOnboardingResults(
  customerId: string,
  currentMeta: Record<string, string>,
  result: OnboardingResult
): Promise<Record<string, string>> {
  const updates: Record<string, string> = {
    persona: result.persona,
    status: "trial",
    preferred_time: result.preferredTime,
    preferred_days: result.preferredDays,
  };

  if (result.firstName) {
    updates.first_name = result.firstName;
  }

  if (result.goals) {
    updates.goals = result.goals.slice(0, 500); // Stripe limit
  }

  log.info("Onboarding complete", {
    customerId,
    persona: result.persona,
    firstName: result.firstName,
  });

  return updates;
}
