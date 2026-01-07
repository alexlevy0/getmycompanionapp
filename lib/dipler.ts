import { PERSONAS, RECEPTIONIST_AGENT_ENV_KEY } from "../constants/personas";
import { Persona } from "../types";

// ============================================
// Trigger Call Parameters
// ============================================

interface TriggerCallParams {
  phone: string;
  agentId?: string; // Optional - defaults to Receptionist if isFirstCall
  context?: string;
  metadata?: Record<string, string>; // For passing customerId, isFirstCall, etc.
  isFirstCall?: boolean; // Convenience flag for Receptionist routing
}

// ============================================
// Get Agent ID Helper
// ============================================

/**
 * Resolves the Dipler agent ID to use for the call.
 * Priority: explicit agentId > persona agent > receptionist (first call)
 */
function resolveAgentId(params: TriggerCallParams): string {
  const { agentId, isFirstCall, metadata } = params;

  // 1. Explicit agent ID provided
  if (agentId) {
    return agentId;
  }

  // 2. First call uses Receptionist
  if (isFirstCall) {
    const receptionist = process.env[RECEPTIONIST_AGENT_ENV_KEY];
    if (!receptionist) {
      throw new Error("DIPLER_AGENT_RECEPTIONIST not configured");
    }
    return receptionist;
  }

  // 3. Check if persona is in metadata (for scheduled calls)
  const persona = metadata?.persona as Persona | undefined;
  if (persona && PERSONAS[persona]) {
    const personaAgent = process.env[PERSONAS[persona].diplerAgentEnvKey];
    if (personaAgent) {
      return personaAgent;
    }
  }

  // 4. Fallback to Receptionist
  const fallback = process.env[RECEPTIONIST_AGENT_ENV_KEY];
  if (!fallback) {
    throw new Error("No Dipler agent configured");
  }
  return fallback;
}

// ============================================
// Trigger Dipler Call
// ============================================

/**
 * Triggers a Dipler call with the specified parameters.
 * 
 * @param params.phone - Phone number in E.164 format
 * @param params.agentId - Optional explicit agent ID
 * @param params.context - Optional context for the agent
 * @param params.metadata - Metadata to pass through (returned in webhook)
 * @param params.isFirstCall - If true, uses Receptionist agent
 */
export async function triggerDiplerCall(params: TriggerCallParams): Promise<void> {
  const { phone, context, metadata = {} } = params;

  const agentId = resolveAgentId(params);

  // Ensure customerId is passed for webhook processing
  if (!metadata.customerId) {
    console.warn("triggerDiplerCall: No customerId in metadata");
  }

  const response = await fetch("https://api.dipler.io/v1/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIPLER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      phone_number: phone,
      webhook_url: `${process.env.API_BASE_URL}/api/webhook/dipler`,
      metadata: {
        ...metadata,
        isFirstCall: params.isFirstCall ? "true" : "false",
      },
      ...(context && { context }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dipler API error: ${error}`);
  }
}

// ============================================
// Agent ID Getters (for explicit use)
// ============================================

export function getReceptionistAgentId(): string {
  const agentId = process.env[RECEPTIONIST_AGENT_ENV_KEY];
  if (!agentId) {
    throw new Error("DIPLER_AGENT_RECEPTIONIST not configured");
  }
  return agentId;
}

export function getPersonaAgentId(persona: Persona): string {
  const config = PERSONAS[persona];
  if (!config) {
    throw new Error(`Unknown persona: ${persona}`);
  }
  const agentId = process.env[config.diplerAgentEnvKey];
  if (!agentId) {
    throw new Error(`Agent not configured for persona: ${persona}`);
  }
  return agentId;
}
