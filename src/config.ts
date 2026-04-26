import path from "node:path";

export const config = {
  appName: "NerdyGeek",
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  cacheTtlMs: 12 * 60 * 60 * 1000,
  fetchTimeoutMs: Number.parseInt(process.env.FETCH_TIMEOUT_MS ?? "12000", 10),
  maxRetrievedPages: Number.parseInt(process.env.MAX_RETRIEVED_PAGES ?? "4", 10),
  dataDir: process.env.NERDYGEEK_DATA_DIR ?? path.join(process.cwd(), ".nerdygeek"),
  httpRateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  httpRateLimitMaxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "60", 10),
  userAgent:
    process.env.DOCS_MCP_USER_AGENT ??
    "NerdyGeek/1.0 (+https://github.com/docxbox/NerdyGeek)"
} as const;
