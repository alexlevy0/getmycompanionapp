import { Persona } from "../types";
import { PERSONAS, RECEPTIONIST_AGENT_ENV_KEY } from "../constants/personas";

interface TriggerCallParams {
  phone: string;
  customerId: string;
  persona?: Persona; // Optional - if not provided, uses Receptionist
  isFirstCall: boolean;
  context?: string;
}

export async function triggerDiplerCall(params: TriggerCallParams): Promise<void> {
  const { phone, customerId, persona, isFirstCall, context } = params;

  // Use Receptionist agent for first call (onboarding), otherwise use persona agent
  let agentId: string | undefined;
  
  if (isFirstCall || !persona) {
    // First call uses Receptionist for voice-first onboarding
    agentId = process.env[RECEPTIONIST_AGENT_ENV_KEY];
    if (!agentId) {
      throw new Error("No Dipler Receptionist agent configured");
    }
  } else {
    // Subsequent calls use the assigned persona agent
    agentId = process.env[PERSONAS[persona].diplerAgentEnvKey];
    if (!agentId) {
      throw new Error(`No Dipler agent configured for persona: ${persona}`);
    }
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
        customer_id: customerId,
        is_first_call: isFirstCall,
      },
      ...(context && { context }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dipler API error: ${error}`);
  }
}
