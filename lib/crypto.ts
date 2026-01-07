import { createHash } from "crypto";

/**
 * Hashes a token using SHA-256 for secure storage.
 * This is a one-way operation.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
