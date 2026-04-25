import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { search_docs } from "./searchDocs.js";
import { docsResponseSchema, packageJsonSchema } from "./types.js";

const searchDocsToolInputSchema = z.object({
  query: z.string().min(3),
  packageJson: packageJsonSchema.optional()
});

export function createDocsIntelligenceMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "nerdygeek",
      version: "1.0.0"
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
        "Retrieve version-aware, official documentation for a framework or library using automatic source discovery.",
      inputSchema: searchDocsToolInputSchema,
      outputSchema: docsResponseSchema,
      annotations: {
        title: "Search Docs",
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true
      }
    },
    async ({ query, packageJson }, extra) => {
      try {
        await server.sendLoggingMessage(
          {
            level: "info",
            data: `search_docs requested for query: ${query}`
          },
          extra.sessionId
        );

        const result = await search_docs(
          packageJson
            ? {
                query,
                packageJson
              }
            : {
                query
              }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ],
          structuredContent: result
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";

        await server.sendLoggingMessage(
          {
            level: "error",
            data: `search_docs failed: ${message}`
          },
          extra.sessionId
        );

        return {
          content: [
            {
              type: "text",
              text: `search_docs failed: ${message}`
            }
          ],
          isError: true
        };
      }
    }
  );

  return server;
}
