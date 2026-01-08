// ============================================
// Dipler Config API
// Returns config for frontend WebSocket connection
// ============================================

export async function GET(): Promise<Response> {
  const apiToken = process.env.DIPLER_API_TOKEN;
  const agentId = process.env.DIPLER_AGENT_ID;

  if (!apiToken || !agentId) {
    return Response.json(
      { error: "Dipler not configured" },
      { status: 500 }
    );
  }

  return Response.json({
    apiToken,
    agentId,
  });
}
