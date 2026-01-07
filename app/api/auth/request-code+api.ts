import { stripe, findCustomerByPhone } from "@/lib/stripe";
import { redis } from "@/lib/redis";
import { checkRateLimit } from "@/lib/ratelimit";
import { sendNotificationSMS } from "@/lib/twilio";
import { validatePhone, formatPhoneE164 } from "@/lib/utils";
import { createScopedLogger } from "@/lib/logger";

const log = createScopedLogger("auth-request-code");

// OTP Expiration: 5 minutes
const OTP_TTL_SECONDS = 300;

function generateOTP(): string {
  // Generate secure 6-digit code
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const otp = (array[0] % 1_000_000).toString().padStart(6, "0");
  return otp;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { phone } = await request.json();
    const ip = getClientIp(request);

    // 1. Rate Limiting (3 requests per 10 mins)
    // Using ad-hoc rate limit to prevent SMS spam
    if (redis) {
      const rateLimitKey = `ratelimit:auth:request:${ip}`;
      const requestCount = await redis.incr(rateLimitKey);
      if (requestCount === 1) {
        await redis.expire(rateLimitKey, 600); // 10 mins Window
      }
      if (requestCount > 3) {
        return Response.json(
          { error: "Trop de demandes. Réessayez dans 10 minutes." },
          { status: 429 }
        );
      }
    }

    // 2. Validate Phone
    if (!validatePhone(phone)) {
      return Response.json(
        { error: "Numéro de téléphone invalide." },
        { status: 400 }
      );
    }
    const formattedPhone = formatPhoneE164(phone);

    // 3. User Existence Check
    const customer = await findCustomerByPhone(formattedPhone);
    if (!customer) {
      // Security: Don't reveal if user exists or not, but for MVP we return 404 to block
      return Response.json(
        { error: "Ce numéro n'est pas associé à un compte." },
        { status: 404 }
      );
    }

    // 4. Generate & Store OTP
    const otp = generateOTP();
    if (redis) {
      await redis.setex(`otp:${formattedPhone}`, OTP_TTL_SECONDS, otp);
    } else {
      log.error("Redis not available for OTP storage");
      return Response.json({ error: "Service indisponible temporairement." }, { status: 503 });
    }

    // 5. Send SMS
    await sendNotificationSMS({
      phone: formattedPhone,
      message: `Votre code de connexion MyCompanion est : ${otp}. Il expire dans 5 minutes.`,
    });

    log.info(`OTP sent to ${formattedPhone}`);
    return Response.json({ success: true, message: "Code envoyé" });

  } catch (error) {
    log.error("Request code error", { error });
    return Response.json(
      { error: "Une erreur est survenue." },
      { status: 500 }
    );
  }
}
