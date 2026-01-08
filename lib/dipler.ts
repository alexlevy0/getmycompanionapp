// ============================================
// Dipler WebSocket Configuration
// ============================================

/**
 * WebSocket URL for Dipler real-time streaming
 */
export const DIPLER_WS_URL = "wss://dipler-backend-203319928451.europe-west9.run.app/stream";

/**
 * Get Dipler configuration for WebSocket connection
 */
export function getDiplerConfig() {
  const apiToken = process.env.DIPLER_API_TOKEN;
  const agentId = process.env.DIPLER_AGENT_ID;

  if (!apiToken || !agentId) {
    return null;
  }

  return {
    apiToken,
    agentId,
    wsUrl: DIPLER_WS_URL,
  };
}
