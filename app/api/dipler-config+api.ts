// ============================================
// Dipler Config API
// Returns config for frontend WebSocket connection
// Optionally includes userIdForMemory if authenticated
// ============================================

import { stripe } from "@/lib/stripe";
import { hashToken } from "@/lib/crypto";

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;
  
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  
  return parts[1];
}

async function findCustomerByToken(token: string): Promise<string | null> {
  try {
    const tokenHash = hashToken(token);
    const result = await stripe.customers.search({
      query: `metadata['auth_token_hash']:'${tokenHash}'`,
    });
    return result.data[0]?.id || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const apiToken = process.env.DIPLER_API_TOKEN;
  const agentId = process.env.DIPLER_AGENT_ID;

  if (!apiToken || !agentId) {
    return Response.json(
      { error: "Dipler not configured" },
      { status: 500 }
    );
  }

  // Check for auth token to get userIdForMemory
  const authToken = extractBearerToken(request);
  let userIdForMemory: string | undefined;

  if (authToken) {
    const customerId = await findCustomerByToken(authToken);
    if (customerId) {
      userIdForMemory = customerId;
    }
  }

  return Response.json({
    apiToken,
    agentId,
    ...(userIdForMemory && { userIdForMemory }),
  });
}
