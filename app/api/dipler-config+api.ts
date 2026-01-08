// ============================================
// Dipler Config API
// Returns config for frontend WebSocket connection
// Optionally includes userIdForMemory if authenticated
// ============================================

import { checkRateLimit } from "@/lib/ratelimit";
import { createScopedLogger } from "@/lib/logger";
import { extractBearerToken, getUserProfile } from "@/lib/auth";

const log = createScopedLogger("dipler-config");

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function GET(request: Request): Promise<Response> {
  // 1. Rate Limiting
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await checkRateLimit("diplerConfig", ip);

  if (!success) {
    log.warn("Rate limit exceeded", { ip });
    return Response.json(
      { error: "Too many requests" },
      { 
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        }
      }
    );
  }

  const apiToken = process.env.DIPLER_API_TOKEN;
  const agentId = process.env.DIPLER_AGENT_ID;

  if (!apiToken || !agentId) {
    log.error("Dipler configuration missing");
    return Response.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  // 2. Authentication (Mandatory)
  const token = extractBearerToken(request);
  if (!token) {
    log.warn("Missing auth token", { ip });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userProfile = await getUserProfile(token);
  if (!userProfile) {
    log.warn("Invalid auth token", { ip });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Return Config
  return Response.json({
    apiToken,
    agentId,
    userIdForMemory: userProfile.id,
  });
}
