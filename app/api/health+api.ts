/**
 * Health check endpoint
 * Useful for monitoring and load balancers
 */
export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    service: "mycompanion",
  });
}
