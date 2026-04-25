import express from "express";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { createDocsIntelligenceMcpServer } from "./mcpServer.js";

const host = process.env.HOST ?? "127.0.0.1";
const app = createMcpExpressApp({ host });

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    service: config.appName,
    transport: "streamable-http"
  });
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
  console.log(`${config.appName} MCP listening on http://${host}:${config.port}/mcp`);
});
