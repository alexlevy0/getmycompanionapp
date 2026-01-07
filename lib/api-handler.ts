import { log } from "./logger";

// ============================================
// API Handler Wrapper
// ============================================

type ApiHandler = (request: Request) => Promise<Response>;

interface ApiHandlerOptions {
  name: string; // For logging
}

/**
 * Wraps an API handler with error handling and logging.
 */
export function createApiHandler(
  handler: ApiHandler,
  options: ApiHandlerOptions
): ApiHandler {
  return async (request: Request): Promise<Response> => {
    const startTime = Date.now();
    
    try {
      const response = await handler(request);
      
      const duration = Date.now() - startTime;
      log.info(`${options.name} completed`, {
        status: response.status,
        duration: `${duration}ms`,
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error(`${options.name} failed`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration: `${duration}ms`,
      });
      
      return Response.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

// ============================================
// Response Helpers
// ============================================

export const ApiResponse = {
  success: <T>(data: T, status = 200) => 
    Response.json(data, { status }),
  
  error: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
  
  unauthorized: (message = "Unauthorized") =>
    new Response(message, { status: 401 }),
  
  notFound: (message = "Not found") =>
    new Response(message, { status: 404 }),
  
  conflict: (message: string) =>
    Response.json({ error: message }, { status: 409 }),
};
