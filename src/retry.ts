import type { DocsResponse } from "./types.js";
import { validate } from "./validation.js";

export async function withRetry(fn: () => Promise<DocsResponse>, retries = 2): Promise<DocsResponse> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await fn();
      return validate(result);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown retry failure");
}
