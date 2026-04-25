# NerdyGeek

> Auto-discover official docs. Keep coding with fresh references.

[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blue)](https://github.com/docxbox/NerdyGeek)
[![MCP Server](https://img.shields.io/badge/MCP-Server-black)](https://modelcontextprotocol.io/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/docxbox/NerdyGeek?style=social)](https://github.com/docxbox/NerdyGeek/stargazers)

NerdyGeek is a TypeScript Node.js MCP server and Claude Code plugin that gives coding agents a single tool: `search_docs`.

When an agent gets stuck, NerdyGeek detects the stack, finds the latest official documentation, resolves version context, ranks the most relevant sections, filters noise, and returns a structured answer with code examples and source links.

## Why NerdyGeek

- No static docs registry
- Dynamic official-doc discovery
- Version-aware lookups from query and `package.json`
- Deterministic ranking and validation
- Structured responses for agent workflows
- Works locally with Claude Code and Codex
- Can also be deployed as a public HTTP MCP server

## What The Tool Returns

```ts
type DocsResponse = {
  stack: string;
  version: string;
  answer: string;
  code?: string;
  sources: string[];
  confidence: number;
};
```

Example input:

```json
{
  "query": "next 14 server actions cookies",
  "packageJson": {
    "dependencies": {
      "next": "^14.2.1",
      "react": "^18.2.0"
    }
  }
}
```

Example output:

```json
{
  "stack": "nextjs",
  "version": "14",
  "answer": "Use cookies() from next/headers inside a Server Action to read and write cookies in the App Router.",
  "code": "'use server'\\nimport { cookies } from 'next/headers'\\n...",
  "sources": [
    "https://nextjs.org/docs/app/api-reference/functions/cookies"
  ],
  "confidence": 0.82
}
```

## Install

Clone the repo and build once:

```bash
npm install
npm run build
```

Then install NerdyGeek for your coding agent:

| Agent | Install |
|---|---|
| Claude Code | `npm run install:claude-code` |
| Codex | `npm run install:codex` |
| Both | `npm run install:all` |

## Agent Setup

### Claude Code

This repo is packaged as a Claude Code plugin marketplace repo and also includes a project MCP config.

Local project config:

```json
{
  "mcpServers": {
    "nerdygeek": {
      "command": "node",
      "args": ["dist/src/stdio.js"],
      "env": {}
    }
  }
}
```

Relevant files:

- [`.mcp.json`](./.mcp.json)
- [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json)
- [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json)
- [`skills/latest-docs/SKILL.md`](./skills/latest-docs/SKILL.md)

Marketplace install:

```bash
claude plugin marketplace add docxbox/NerdyGeek
claude plugin install nerdygeek@nerdygeek
```

### Codex

NerdyGeek exposes an HTTP MCP endpoint for Codex:

```toml
[mcp_servers.nerdygeek]
url = "http://127.0.0.1:3000/mcp"
```

Install helper:

```bash
npm run install:codex
```

Then start the local MCP server:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-codex-local.ps1
```

Relevant example configs:

- [`examples/codex-config.toml`](./examples/codex-config.toml)
- [`examples/codex-config.public.toml`](./examples/codex-config.public.toml)

### Claude Desktop

You can also use the bundled Claude Desktop package:

- [`artifacts/nerdygeek-1.0.0.mcpb`](./artifacts/nerdygeek-1.0.0.mcpb)
- [`bundle/manifest.json`](./bundle/manifest.json)

## Run Locally

Stdio MCP server:

```bash
npm start
```

HTTP MCP server:

```bash
npm run start:http
```

Local HTTP endpoint:

```text
http://127.0.0.1:3000/mcp
```

## How It Works

NerdyGeek follows a deterministic docs-intelligence pipeline:

1. Detect the likely stack from the query and optional `package.json`
2. Discover official documentation sources dynamically
3. Resolve version context from the query or dependency metadata
4. Check the semantic cache
5. Retrieve documentation pages
6. Extract clean text and relevant code
7. Rank chunks and code examples
8. Validate the final response before returning it

Core implementation:

- [`src/searchDocs.ts`](./src/searchDocs.ts)
- [`src/discovery.ts`](./src/discovery.ts)
- [`src/retriever.ts`](./src/retriever.ts)
- [`src/extractor.ts`](./src/extractor.ts)
- [`src/ranker.ts`](./src/ranker.ts)
- [`src/validation.ts`](./src/validation.ts)
- [`src/mcpServer.ts`](./src/mcpServer.ts)
- [`src/httpServer.ts`](./src/httpServer.ts)
- [`src/stdio.ts`](./src/stdio.ts)

## Scripts

- `npm run build`
- `npm start`
- `npm run start:http`
- `npm run bundle`
- `npm run install:claude-code`
- `npm run install:codex`
- `npm run install:all`
- `npm test`


## Star History

If NerdyGeek is useful, give it a star and help more agents stop coding from stale docs.

[![Star History Chart](https://api.star-history.com/svg?repos=docxbox/NerdyGeek&type=Date)](https://www.star-history.com/#docxbox/NerdyGeek&Date)

## License

[MIT](./LICENSE)
