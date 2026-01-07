import { formatPhoneE164 } from './utils';

// ============================================
// Dipler Call Result Interface
// ============================================

interface DiplerCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  futureConversationId?: string;
}

// ============================================
// Trigger Dipler Call
// ============================================

/**
 * Triggers a Dipler call via Twilio integration.
 * 
 * @param toPhoneNumber - Phone number to call (will be normalized to E.164 format)
 * @returns Promise with call result including success status and optional conversation ID
 */
export async function triggerDiplerCall(
  toPhoneNumber: string
): Promise<DiplerCallResult> {
  const normalizedPhoneNumber = formatPhoneE164(toPhoneNumber);

  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(normalizedPhoneNumber)) {
    return {
      success: false,
      error: 'Invalid phone number format for internal call.'
    };
  }

  const diplerConfig = {
    url: process.env.DIPLER_API_URL || 'https://dipler-backend-203319928451.europe-west9.run.app',
    token: process.env.DIPLER_API_TOKEN,
    fromPhoneNumber: process.env.DIPLER_FROM_PHONE,
    agentId: process.env.DIPLER_AGENT_ID,
    workspaceId: process.env.DIPLER_WORKSPACE_ID,
  };

  if (!diplerConfig.token || !diplerConfig.fromPhoneNumber || !diplerConfig.agentId || !diplerConfig.workspaceId) {
    console.error('[DIPLER] Missing environment variables for Dipler API');
    return {
      success: false,
      error: 'Invalid server configuration'
    };
  }

  const payload = {
    fromPhoneNumber: diplerConfig.fromPhoneNumber,
    toPhoneNumber: normalizedPhoneNumber,
    agentId: diplerConfig.agentId,
    workspaceId: diplerConfig.workspaceId,
  };
  console.log('[DIPLER] Call payload:', payload);

  try {
    const response = await fetch(diplerConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${diplerConfig.token}`,
      },
      body: JSON.stringify({
        service: 'twilio',
        action: 'makeCall',
        payload,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[DIPLER] API error:', data);
      return {
        success: false,
        error: 'Error during internal phone call'
      };
    }

    return {
      success: true,
      data,
      futureConversationId: data.futureConversationId
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('[DIPLER] API error:', error);
      return {
        success: false,
        error: `Internal server error: ${error.message}`
      };
    }
    console.error('[DIPLER] API error:', error);
    return {
      success: false,
      error: 'Internal server error: Unknown error'
    };
  }
}
