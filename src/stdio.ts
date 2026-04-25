import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDocsIntelligenceMcpServer } from "./mcpServer.js";

async function main(): Promise<void> {
  const server = createDocsIntelligenceMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
