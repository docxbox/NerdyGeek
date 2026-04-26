import express from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createDocsIntelligenceMcpServer } from "./mcpServer.js";
import { metrics } from "./metrics.js";
import { FixedWindowRateLimiter } from "./rateLimit.js";

const host = process.env.HOST ?? "127.0.0.1";
const app = createMcpExpressApp({ host });
const limiter = new FixedWindowRateLimiter(config.httpRateLimitMaxRequests, config.httpRateLimitWindowMs);

app.use(express.json({ limit: "1mb" }));

app.use((request, response, next) => {
  const startedAt = performance.now();
  const ip = request.ip || request.socket.remoteAddress || "unknown";
  const limit = limiter.allow(ip);

  if (!limit.allowed) {
    metrics.increment("http.rate_limited");
    response.setHeader("Retry-After", Math.ceil(limit.retryAfterMs / 1000));
    response.status(429).json({
      error: "Rate limit exceeded",
      retryAfterMs: limit.retryAfterMs
    });
    return;
  }

  response.on("finish", () => {
    metrics.increment(`http.status.${response.statusCode}`);
    metrics.observe("http.request.latency_ms", performance.now() - startedAt);
  });

  next();
});

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: config.appName,
    transport: "streamable-http"
  });
});

app.get("/ready", (_request, response) => {
  response.json({
    ok: true,
    service: config.appName,
    dataDir: config.dataDir
  });
});

app.get("/metrics", (_request, response) => {
  response.json(metrics.snapshot());
});

app.post("/mcp", async (request, response) => {
  const server = createDocsIntelligenceMcpServer();
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true
  });

  try {
    await server.connect(transport as Parameters<typeof server.connect>[0]);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("HTTP MCP request failed", {
      message,
      path: request.path
    });

    if (!response.headersSent) {
      response.status(500).json({
        error: message
      });
    }
  } finally {
    await server.close().catch(() => undefined);
  }
});

app.listen(config.port, host, () => {
  logger.info("NerdyGeek MCP server listening", {
    url: `http://${host}:${config.port}/mcp`
  });
});
