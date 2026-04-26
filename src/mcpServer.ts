import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import { diff_docs } from "./diffDocs.js";
import { logger } from "./logger.js";
import { metrics } from "./metrics.js";
import { scan_deprecations } from "./scanDeprecations.js";
import { search_docs } from "./searchDocs.js";
import {
  diffResponseSchema,
  docsModeSchema,
  lockfileContextSchema,
  packageJsonSchema,
  scanResponseSchema,
  searchDocsResponseSchema
} from "./types.js";

const searchDocsToolInputSchema = z.object({
  query: z.string().min(3),
  mode: docsModeSchema.optional(),
  packageJson: packageJsonSchema.optional(),
  lockfiles: lockfileContextSchema.optional()
});

const diffDocsToolInputSchema = z.object({
  stack: z.string().min(1),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1)
});

const scanDeprecationsToolInputSchema = z.object({
  fileContent: z.string().min(1),
  stack: z.string().min(1),
  version: z.string().optional()
});

async function instrument<T>(tool: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await fn();
    metrics.increment(`tool.${tool}.success`);
    metrics.observe(`tool.${tool}.latency_ms`, performance.now() - startedAt);
    return result;
  } catch (error) {
    metrics.increment(`tool.${tool}.failure`);
    metrics.observe(`tool.${tool}.latency_ms`, performance.now() - startedAt);
    throw error;
  }
}

export function createDocsIntelligenceMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "nerdygeek",
      version: pkg.version
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  server.registerTool(
    "search_docs",
    {
      title: "Search Docs",
      description:
        "Retrieve version-aware, official documentation for a framework or library. " +
        "Supports mode='quick', 'full', and 'deep', plus lockfile-aware version pinning.",
      inputSchema: searchDocsToolInputSchema,
      outputSchema: searchDocsResponseSchema,
      annotations: {
        title: "Search Docs",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ query, mode, packageJson, lockfiles }, extra) => {
      try {
        await server.sendLoggingMessage(
          { level: "info", data: `search_docs requested: query="${query}" mode=${mode ?? "full"}` },
          extra.sessionId
        );

        const result = await instrument("search_docs", () =>
          search_docs({
            query,
            ...(mode !== undefined && { mode }),
            ...(packageJson !== undefined && { packageJson }),
            ...(lockfiles !== undefined && { lockfiles: lockfiles as import("./types.js").LockfileContext })
          })
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("search_docs failed", { message });
        await server.sendLoggingMessage({ level: "error", data: `search_docs failed: ${message}` }, extra.sessionId);
        return {
          content: [{ type: "text", text: `search_docs failed: ${message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "diff_docs",
    {
      title: "Diff Docs",
      description:
        "Compare two versions of a framework or library and return structured new, deprecated, removed, and breaking changes.",
      inputSchema: diffDocsToolInputSchema,
      outputSchema: diffResponseSchema,
      annotations: {
        title: "Diff Docs",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ stack, fromVersion, toVersion }, extra) => {
      try {
        await server.sendLoggingMessage(
          { level: "info", data: `diff_docs requested: ${stack} ${fromVersion} -> ${toVersion}` },
          extra.sessionId
        );

        const result = await instrument("diff_docs", () => diff_docs({ stack, fromVersion, toVersion }));

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("diff_docs failed", { message });
        await server.sendLoggingMessage({ level: "error", data: `diff_docs failed: ${message}` }, extra.sessionId);
        return {
          content: [{ type: "text", text: `diff_docs failed: ${message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "scan_deprecations",
    {
      title: "Scan Deprecations",
      description:
        "Scan a file's source code for deprecated or removed APIs based on official migration and deprecation docs.",
      inputSchema: scanDeprecationsToolInputSchema,
      outputSchema: scanResponseSchema,
      annotations: {
        title: "Scan Deprecations",
        readOnlyHint: true,
        openWorldHint: true
      }
    },
    async ({ fileContent, stack, version }, extra) => {
      try {
        await server.sendLoggingMessage(
          { level: "info", data: `scan_deprecations requested: stack=${stack} version=${version ?? "latest"}` },
          extra.sessionId
        );

        const result = await instrument("scan_deprecations", () =>
          scan_deprecations({
            fileContent,
            stack,
            ...(version !== undefined && { version })
          })
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error("scan_deprecations failed", { message });
        await server.sendLoggingMessage({ level: "error", data: `scan_deprecations failed: ${message}` }, extra.sessionId);
        return {
          content: [{ type: "text", text: `scan_deprecations failed: ${message}` }],
          isError: true
        };
      }
    }
  );

  return server;
}
