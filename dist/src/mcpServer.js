import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import { search_docs } from "./searchDocs.js";
import { diff_docs } from "./diffDocs.js";
import { scan_deprecations } from "./scanDeprecations.js";
import { docsResponseSchema, docsModeSchema, lockfileContextSchema, packageJsonSchema } from "./types.js";
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
export function createDocsIntelligenceMcpServer() {
    const server = new McpServer({
        name: "nerdygeek",
        version: pkg.version
    }, {
        capabilities: {
            logging: {}
        }
    });
    server.registerTool("search_docs", {
        title: "Search Docs",
        description: "Retrieve version-aware, official documentation for a framework or library. " +
            "Supports mode='quick' (signature + 1 example), 'full' (default, full API), " +
            "'deep' (internals, edge cases, alternatives). " +
            "Pass lockfiles (goMod, cargoToml, requirementsTxt, gemfileLock) for accurate version pinning.",
        inputSchema: searchDocsToolInputSchema,
        outputSchema: docsResponseSchema,
        annotations: {
            title: "Search Docs",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        }
    }, async ({ query, mode, packageJson, lockfiles }, extra) => {
        try {
            await server.sendLoggingMessage({ level: "info", data: `search_docs requested: query="${query}" mode=${mode ?? "full"}` }, extra.sessionId);
            const result = await search_docs({
                query,
                ...(mode !== undefined && { mode }),
                ...(packageJson !== undefined && { packageJson }),
                ...(lockfiles !== undefined && { lockfiles: lockfiles })
            });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: result
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await server.sendLoggingMessage({ level: "error", data: `search_docs failed: ${message}` }, extra.sessionId);
            return {
                content: [{ type: "text", text: `search_docs failed: ${message}` }],
                isError: true
            };
        }
    });
    server.registerTool("diff_docs", {
        title: "Diff Docs",
        description: "Compare two versions of a framework or library and return a structured list of new features, " +
            "deprecated APIs, removed APIs, and breaking changes. " +
            "Example: diff_docs({ stack: 'react', fromVersion: '18', toVersion: '19' })",
        inputSchema: diffDocsToolInputSchema,
        annotations: {
            title: "Diff Docs",
            readOnlyHint: true,
            idempotentHint: true,
            openWorldHint: true
        }
    }, async ({ stack, fromVersion, toVersion }, extra) => {
        try {
            await server.sendLoggingMessage({ level: "info", data: `diff_docs requested: ${stack} ${fromVersion} -> ${toVersion}` }, extra.sessionId);
            const result = await diff_docs({ stack, fromVersion, toVersion });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await server.sendLoggingMessage({ level: "error", data: `diff_docs failed: ${message}` }, extra.sessionId);
            return {
                content: [{ type: "text", text: `diff_docs failed: ${message}` }],
                isError: true
            };
        }
    });
    server.registerTool("scan_deprecations", {
        title: "Scan Deprecations",
        description: "Scan a file's source code for deprecated or removed APIs based on the stack's official changelog. " +
            "Returns line numbers, deprecated API names, reasons, and suggested replacements. " +
            "Example: scan_deprecations({ fileContent: '...', stack: 'react', version: '19' })",
        inputSchema: scanDeprecationsToolInputSchema,
        annotations: {
            title: "Scan Deprecations",
            readOnlyHint: true,
            openWorldHint: true
        }
    }, async ({ fileContent, stack, version }, extra) => {
        try {
            await server.sendLoggingMessage({ level: "info", data: `scan_deprecations requested: stack=${stack} version=${version ?? "latest"}` }, extra.sessionId);
            const result = await scan_deprecations({
                fileContent,
                stack,
                ...(version !== undefined && { version })
            });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            await server.sendLoggingMessage({ level: "error", data: `scan_deprecations failed: ${message}` }, extra.sessionId);
            return {
                content: [{ type: "text", text: `scan_deprecations failed: ${message}` }],
                isError: true
            };
        }
    });
    return server;
}
