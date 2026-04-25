export const config = {
  appName: "NerdyGeek",
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  cacheTtlMs: 12 * 60 * 60 * 1000,
  fetchTimeoutMs: Number.parseInt(process.env.FETCH_TIMEOUT_MS ?? "12000", 10),
  maxRetrievedPages: Number.parseInt(process.env.MAX_RETRIEVED_PAGES ?? "4", 10),
  userAgent:
    process.env.DOCS_MCP_USER_AGENT ??
    "Docs-Intelligence-MCP/1.0 (+https://localhost/docs-intelligence-mcp)"
} as const;
