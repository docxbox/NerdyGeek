import { config } from "./config.js";

export async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": config.userAgent,
        "accept-language": "en-US,en;q=0.9",
        ...init.headers
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}
