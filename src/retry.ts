import type { NerdyGeekResponse } from "./types.js";
import { validate } from "./validation.js";

export async function withRetry<T extends NerdyGeekResponse>(fn: () => Promise<T>, retries = 2): Promise<T> {
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
