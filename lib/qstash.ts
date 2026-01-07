import { Client, Receiver } from "@upstash/qstash";
import { log } from "./logger";

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

interface ScheduleParams {
  phone: string;
  customerId: string;
  scheduledFor: Date;
}

export async function scheduleNextCall(
  params: ScheduleParams
): Promise<string> {
  const { phone, customerId, scheduledFor } = params;

  const result = await qstash.publishJSON({
    url: `${process.env.API_BASE_URL}/api/trigger-call`,
    body: { phone, customerId },
    notBefore: Math.floor(scheduledFor.getTime() / 1000),
  });

  return result.messageId;
}

/**
 * Cancels a scheduled call.
 * Swallows errors if the message is already gone or invalid.
 */
export async function cancelScheduledCall(messageId: string): Promise<void> {
  try {
    await qstash.messages.delete(messageId);
  } catch (error) {
    log.warn("Failed to cancel scheduled call", { 
      messageId, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

export async function verifyQStashSignature(request: Request): Promise<boolean> {
  try {
    const body = await request.clone().text();
    const signature = request.headers.get("upstash-signature");

    if (!signature) return false;

    return await receiver.verify({
      body,
      signature,
      url: `${process.env.API_BASE_URL}/api/trigger-call`,
    });
  } catch {
    return false;
  }
}
