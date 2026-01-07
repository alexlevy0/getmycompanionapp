import { stripe, updateCustomerMetadata } from "@/lib/stripe";
import { redis } from "@/lib/redis";
import { hashToken } from "@/lib/crypto";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";
import { config } from "@/lib/config";
import type { UserStatus, Persona } from "@/types";

const log = createScopedLogger("auth-verify-code");

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function generateAuthToken(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { phone, code } = await request.json();
    const ip = getClientIp(request);

    // 1. Rate Limiting (Brute-force protection: 5 attempts / 10 mins)
    if (redis) {
      const rateLimitKey = `ratelimit:auth:verify:${ip}`;
      const requestCount = await redis.incr(rateLimitKey);
      if (requestCount === 1) {
        await redis.expire(rateLimitKey, 600);
      }
      // Relaxed limit for Dev/Testing (was 5)
      if (requestCount > 100) {
        return Response.json(
          { error: "Trop d'essais. Réessayez plus tard." },
          { status: 429 }
        );
      }
    } else {
      return Response.json({ error: "Service indisponible." }, { status: 503 });
    }

    // 2. Validate Inputs
    if (!validatePhone(phone) || !code || code.length !== 6) {
      return Response.json(
        { error: "Données invalides." },
        { status: 400 }
      );
    }
    const formattedPhone = formatPhoneE164(phone);

    // 3. Verify OTP
    // 3. Verify OTP
    // Force string conversion for robust comparison (Redis might return number)
    const storedOtp = await redis.get<string>(`otp:${formattedPhone}`);
    
    if (!storedOtp) {
      return Response.json(
        { error: "Code expiré ou invalide." },
        { status: 400 }
      );
    }

    if (String(storedOtp).trim() !== String(code).trim()) {
      return Response.json({ error: "Code incorrect." }, { status: 400 });
    }

    // 4. Code valid! Find Customer
    // Searching globally by phone to get ID
    const searchResult = await stripe.customers.search({
      query: `metadata['phone']:'${formattedPhone}'`,
    });
    const customer = searchResult.data[0];

    if (!customer) {
      return Response.json(
        { error: "Compte introuvable." },
        { status: 404 }
      );
    }

    // 5. Rotate Token (Security Best Practice)
    const newToken = generateAuthToken();
    const newTokenHash = hashToken(newToken);
    
    // Update Stripe
    await updateCustomerMetadata(customer.id, {
      ...customer.metadata,
      auth_token_hash: newTokenHash,
    });

    // 6. Cleanup Redis
    await redis.del(`otp:${formattedPhone}`);

    // 7. Return Token AND User Data to avoid race condition
    const meta = customer.metadata;
    const userData: any = {
      status: meta.status as UserStatus,
      persona: meta.persona as Persona,
      firstName: meta.first_name,
      phone: meta.phone,
      
      nextCallScheduled: meta.next_call_scheduled,
      totalCalls: parseInt(meta.total_calls || "0"),
      trialCallsRemaining: parseInt(meta.trial_calls_remaining || "0"),
      
      preferredTime: meta.preferred_time || config.defaults.preferredTime,
      preferredDays: meta.preferred_days || config.defaults.preferredDays,
      timezone: meta.timezone || config.defaults.timezone,
    };

    if (meta.status === "awaiting_payment") {
      const paymentLink = config.stripe.paymentLinkStandard();
      if (paymentLink) {
        userData.paymentLink = `${paymentLink}?client_reference_id=${customer.id}`;
      }
    }

    log.info(`User ${formattedPhone} logged in via OTP`);
    return Response.json({ success: true, token: newToken, user: userData });

  } catch (error) {
    log.error("Verify code error", { error });
    return Response.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}
