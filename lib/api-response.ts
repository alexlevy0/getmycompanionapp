import { createScopedLogger } from "./logger";

// ============================================
// Types
// ============================================

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface ApiErrorDetails {
  code?: string;
  field?: string;
  details?: unknown;
}

// ============================================
// Logger
// ============================================

const log = createScopedLogger("api-response");

// ============================================
// Success Response
// ============================================

/**
 * Creates a successful JSON response.
 */
export function apiSuccess<T extends Record<string, JsonValue>>(
  data: T,
  status = 200
): Response {
  return Response.json(data, { status });
}

// ============================================
// Error Response
// ============================================

/**
 * Creates an error JSON response with consistent structure.
 */
export function apiError(
  message: string,
  status = 500,
  details?: ApiErrorDetails
): Response {
  const body: Record<string, JsonValue> = { error: message };

  if (details?.code) {
    body.code = details.code;
  }
  if (details?.field) {
    body.field = details.field;
  }

  return Response.json(body, { status });
}

// ============================================
// Common Errors
// ============================================

export const ApiErrors = {
  unauthorized: () => apiError("Unauthorized", 401),
  forbidden: () => apiError("Forbidden", 403),
  notFound: (resource = "Resource") => apiError(`${resource} not found`, 404),
  badRequest: (message = "Invalid request") => apiError(message, 400),
  rateLimit: (headers?: Record<string, string>) =>
    Response.json(
      { error: "Too many requests" },
      { status: 429, headers }
    ),
  internalError: (message = "Internal server error") => apiError(message, 500),
  serviceUnavailable: (message = "Service unavailable") => apiError(message, 503),
} as const;

// ============================================
// Error Handler Wrapper
// ============================================

type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Wraps a route handler with standardized error handling.
 * Catches unhandled errors and returns a consistent error response.
 */
export function withErrorHandler(
  handler: RouteHandler,
  context?: string
): RouteHandler {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`${context || "Route"} error: ${errorMessage}`, { error });

      return ApiErrors.internalError();
    }
  };
}

// ============================================
// Validation Helper
// ============================================

import { ZodSchema } from "zod";

/**
 * Validates request body against a Zod schema.
 * Returns parsed data or an error response.
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: Response }> {
  try {
    const json = await request.json();
    const result = schema.safeParse(json);

    if (!result.success) {
      const firstError = result.error.errors[0];
      return {
        error: apiError(
          firstError?.message || "Validation failed",
          400,
          { field: firstError?.path?.join(".") }
        ),
      };
    }

    return { data: result.data };
  } catch {
    return { error: apiError("Invalid JSON body", 400) };
  }
}
