import twilio from "twilio";

// ============================================
// Twilio Client
// ============================================

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ============================================
// Send Payment SMS
// ============================================

interface SendPaymentSMSParams {
  phone: string;
  customerId: string;
  firstName?: string;
}

/**
 * Sends an SMS with a Stripe Payment Link to convert trial → paid.
 * The `client_reference_id` parameter links the payment to the Stripe Customer.
 */
export async function sendPaymentSMS(params: SendPaymentSMSParams): Promise<void> {
  const { phone, customerId, firstName } = params;

  // Validate environment
  if (!process.env.STRIPE_PAYMENT_LINK_STANDARD) {
    console.error("STRIPE_PAYMENT_LINK_STANDARD not configured");
    throw new Error("Payment link not configured");
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.error("TWILIO_PHONE_NUMBER not configured");
    throw new Error("Twilio not configured");
  }

  // Build payment link with client_reference_id for tracking
  const paymentLink = `${process.env.STRIPE_PAYMENT_LINK_STANDARD}?client_reference_id=${customerId}`;

  // Personalized greeting
  const greeting = firstName ? `${firstName}, merci` : "Merci";

  const message = `${greeting} d'avoir essayé MyCompanion ! 🎉

Vos 3 appels gratuits sont terminés. Pour continuer à recevoir votre appel quotidien :

${paymentLink}

À très vite ! 
— L'équipe MyCompanion`;

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    console.log(`Payment SMS sent to ${phone} for customer ${customerId}`);
  } catch (error) {
    console.error(`Failed to send payment SMS to ${phone}:`, error);
    // Don't throw - we don't want to fail the webhook if SMS fails
    // The user can still pay via other means
  }
}

// ============================================
// Send Notification SMS (Generic)
// ============================================

interface SendNotificationSMSParams {
  phone: string;
  message: string;
}

/**
 * Sends a generic notification SMS.
 */
export async function sendNotificationSMS(params: SendNotificationSMSParams): Promise<void> {
  const { phone, message } = params;

  if (!process.env.TWILIO_PHONE_NUMBER || !process.env.TWILIO_ACCOUNT_SID) {
    console.warn("TWILIO not configured. Mocking SMS send:");
    console.log("========================================");
    console.log(`To: ${phone}`);
    console.log(`Message: ${message}`);
    console.log("========================================");
    return;
  }

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
  } catch (error) {
    console.error(`Failed to send SMS to ${phone}:`, error);
  }
}
