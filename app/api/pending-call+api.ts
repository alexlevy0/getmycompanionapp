import { redis } from "@/lib/redis";
import { extractBearerToken, getUserProfile } from "@/lib/auth";
import { apiSuccess, apiError, ApiErrors } from "@/lib/api-response";
import { createScopedLogger } from "@/lib/logger";

const log = createScopedLogger("pending-call");

// ============================================
// Types
// ============================================

interface PendingCall {
  callId: string;
  customerId: string;
  phone: string;
  firstName?: string;
  timestamp: number;
  expiresAt: number;
}

// ============================================
// GET: Check for pending call
// ============================================

export async function GET(request: Request): Promise<Response> {
  try {
    // 1. Authenticate
    const token = extractBearerToken(request);
    if (!token) {
      return ApiErrors.unauthorized();
    }

    const userProfile = await getUserProfile(token);
    if (!userProfile) {
      return ApiErrors.unauthorized();
    }

    // 2. Check Redis
    if (!redis) {
      return apiSuccess({ hasPendingCall: false });
    }

    const data = await redis.get<string>(`pending_call:${userProfile.id}`);
    
    if (!data) {
      return apiSuccess({ hasPendingCall: false });
    }

    const pendingCall: PendingCall = typeof data === "string" ? JSON.parse(data) : data;

    // 3. Check if expired
    if (Date.now() > pendingCall.expiresAt) {
      await redis.del(`pending_call:${userProfile.id}`);
      return apiSuccess({ hasPendingCall: false });
    }

    return apiSuccess({
      hasPendingCall: true,
      callId: pendingCall.callId,
      firstName: pendingCall.firstName || "",
      timestamp: pendingCall.timestamp,
    });
  } catch (error) {
    log.error("Check pending call error", { error });
    return ApiErrors.internalError();
  }
}

// ============================================
// POST: Accept or decline pending call
// ============================================

export async function POST(request: Request): Promise<Response> {
  try {
    // 1. Authenticate
    const token = extractBearerToken(request);
    if (!token) {
      return ApiErrors.unauthorized();
    }

    const userProfile = await getUserProfile(token);
    if (!userProfile) {
      return ApiErrors.unauthorized();
    }

    // 2. Parse action
    const body = await request.json();
    const { action, callId } = body;

    if (!action || !["accept", "decline"].includes(action)) {
      return apiError("Invalid action", 400);
    }

    // 3. Check Redis
    if (!redis) {
      return apiError("Service unavailable", 503);
    }

    const data = await redis.get<string>(`pending_call:${userProfile.id}`);
    
    if (!data) {
      return apiError("No pending call found", 404);
    }

    const pendingCall: PendingCall = typeof data === "string" ? JSON.parse(data) : data;

    // 4. Verify callId matches
    if (callId && pendingCall.callId !== callId) {
      return apiError("Call ID mismatch", 400);
    }

    // 5. Remove pending call
    await redis.del(`pending_call:${userProfile.id}`);

    if (action === "accept") {
      log.info("Call accepted", { callId: pendingCall.callId, customerId: userProfile.id });
      return apiSuccess({
        success: true,
        action: "accepted",
        callId: pendingCall.callId,
      });
    }

    // Decline
    log.info("Call declined", { callId: pendingCall.callId, customerId: userProfile.id });
    
    // TODO: Optionally reschedule the call for later
    
    return apiSuccess({
      success: true,
      action: "declined",
    });
  } catch (error) {
    log.error("Handle pending call error", { error });
    return ApiErrors.internalError();
  }
}
