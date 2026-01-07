import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendPaymentSMS(
  phone: string,
  customerId: string,
  firstName?: string
) {
  const greeting = firstName ? `${firstName}, merci` : "Merci";
  const link = `${process.env.STRIPE_PAYMENT_LINK_STANDARD}?client_reference_id=${customerId}`;

  await client.messages.create({
    body: `${greeting} d'avoir essayé MyCompanion ! Pour continuer vos appels quotidiens : ${link}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
}
