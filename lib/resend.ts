import { Resend } from "resend";
import { createScopedLogger } from "./logger";

const log = createScopedLogger("resend");

// ============================================
// Resend Client Configuration
// ============================================

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  log.warn("RESEND_API_KEY not configured - Magic Link auth will NOT work.");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// ============================================
// Send Magic Link Email
// ============================================

interface SendMagicLinkParams {
  email: string;
  token: string;
  firstName?: string;
}

export async function sendMagicLinkEmail({
  email,
  token,
  firstName,
}: SendMagicLinkParams): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    log.error("Resend not configured");
    return { success: false, error: "Email service not configured" };
  }

  const baseUrl = process.env.API_BASE_URL || "http://localhost:8081";
  const magicLink = `${baseUrl}?magic_token=${token}`;

  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";

  try {
    const { error } = await resend.emails.send({
      from: "MyCompanion <noreply@getmycompanion.com>",
      to: email,
      subject: "🔐 Votre lien de connexion MyCompanion",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <h1 style="text-align: center; font-size: 32px; margin-bottom: 8px;">📞</h1>
    <h2 style="text-align: center; color: #1a1a1a; margin-bottom: 24px;">MyCompanion</h2>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      ${greeting}
    </p>
    
    <p style="color: #374151; font-size: 16px; line-height: 1.6;">
      Cliquez sur le bouton ci-dessous pour vous connecter à votre compte MyCompanion :
    </p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${magicLink}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
        Se connecter
      </a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
      Ce lien expire dans <strong>15 minutes</strong>. Si vous n'avez pas demandé ce lien, vous pouvez ignorer cet email.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      MyCompanion - L'IA qui t'appelle
    </p>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      log.error("Failed to send magic link email", { error });
      return { success: false, error: error.message };
    }

    log.info(`Magic link email sent to ${email}`);
    return { success: true };
  } catch (error) {
    log.error("Error sending magic link email", { error });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}
