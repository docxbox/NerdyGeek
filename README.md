# NerdyGeek

> Live docs for coding agents. Fresh references, version-aware answers, less guessing.

[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blue)](https://github.com/docxbox/NerdyGeek)
[![MCP Server](https://img.shields.io/badge/MCP-Server-black)](https://modelcontextprotocol.io/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/docxbox/NerdyGeek?style=social)](https://github.com/docxbox/NerdyGeek/stargazers)

NerdyGeek is a TypeScript Node.js MCP server and Claude Code plugin for coding agents that need current documentation while they work.

It uses a hybrid docs-intelligence approach:
- dynamic discovery and ranking when that is reliable
- curated authoritative fallbacks where the ecosystem is noisy or ambiguous

That tradeoff keeps the tool practical for real coding sessions while still preferring official sources and deterministic output.

The current line of development also adds a V4-style agent contract:
- one shared response envelope across tools
- persistent on-disk cache with reusable doc handles
- rate limiting, metrics, and readiness endpoints for hosted use

## What NerdyGeek Does

NerdyGeek currently exposes three MCP tools:

- `search_docs`
- `diff_docs`
- `scan_deprecations`

These tools help agents:
- fetch current official docs for a query
- compare version changes and migration notes
- scan source code for deprecated or removed APIs

Every tool now returns the same high-level agent-facing shape:

```ts
type NerdyGeekEnvelope = {
  tool: "search_docs" | "diff_docs" | "scan_deprecations";
  stack: string;
  version: string;
  mode: "quick" | "full" | "deep";
  summary: string;
  actions: string[];
  gotchas: string[];
  code?: string;
  sources: string[];
  confidence: number;
  docHandle: string;
  cacheStatus: "hit" | "miss";
  retrievedAt: string;
};
```

## Why NerdyGeek

- Version-aware docs lookup
- Official-source prioritization
- Hybrid discovery for better reliability
- Deterministic ranking and validation
- Structured outputs for agents
- Persistent cache and reusable doc handles
- Basic operational endpoints for hosting
- Local use with Claude Code and Codex
- Optional public HTTP MCP deployment

## Tools

### `search_docs`

Fetch version-aware official documentation for a query.

Input example:

```json
{
  "query": "next 14 server actions cookies",
  "mode": "full",
  "packageJson": {
    "dependencies": {
      "next": "^14.2.1",
      "react": "^18.2.0"
    }
  }
}
```

Output shape:

```ts
type SearchDocsResponse = NerdyGeekEnvelope & {
  tool: "search_docs";
  answer: string;
};
```

### `diff_docs`

Compare two versions of a stack and summarize:

- new features
- deprecated APIs
- removed APIs
- breaking changes

Example:

```json
{
  "stack": "react",
  "fromVersion": "18",
  "toVersion": "19"
}
```

### `scan_deprecations`

Scan source code against official deprecation or migration docs and return matches with line numbers.

Example:

```json
{
  "fileContent": "import { useEffect } from 'react';",
  "stack": "react",
  "version": "19"
}
```

## V4-Oriented Features

- Persistent cache stored under `.nerdygeek/store.json`
- Reusable `docHandle` values across repeated lookups
- Shared summary/actions/gotchas envelope for all tools
- HTTP rate limiting for hosted mode
- `/health`, `/ready`, and `/metrics` endpoints
- structured logging and in-process metrics collection

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

Marketplace install:

```bash
claude plugin marketplace add docxbox/NerdyGeek
claude plugin install nerdygeek@nerdygeek
```

Relevant files:

- [`.mcp.json`](./.mcp.json)
- [`.claude-plugin/plugin.json`](./.claude-plugin/plugin.json)
- [`.claude-plugin/marketplace.json`](./.claude-plugin/marketplace.json)
- [`skills/latest-docs/SKILL.md`](./skills/latest-docs/SKILL.md)

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

Operational endpoints:

```text
http://127.0.0.1:3000/health
http://127.0.0.1:3000/ready
http://127.0.0.1:3000/metrics
```

## How It Works

NerdyGeek follows a hybrid docs-intelligence pipeline:

1. Detect the likely stack from the query and optional project metadata
2. Resolve version context from the query, `package.json`, or supported lockfiles
3. Discover official docs dynamically when possible
4. Fall back to curated authoritative URLs when discovery is unreliable
5. Retrieve relevant pages
6. Extract clean text and code
7. Rank chunks deterministically
8. Format into a shared agent envelope
9. Persist result by cache key and doc handle
10. Validate the final result before returning it

Core implementation:

- [`src/searchDocs.ts`](./src/searchDocs.ts)
- [`src/diffDocs.ts`](./src/diffDocs.ts)
- [`src/scanDeprecations.ts`](./src/scanDeprecations.ts)
- [`src/discovery.ts`](./src/discovery.ts)
- [`src/formatter.ts`](./src/formatter.ts)
- [`src/store.ts`](./src/store.ts)
- [`src/metrics.ts`](./src/metrics.ts)
- [`src/rateLimit.ts`](./src/rateLimit.ts)
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

## Notes On Discovery

NerdyGeek intentionally uses a hybrid strategy now.

Pure auto-discovery sounds cleaner, but in practice some ecosystems are too noisy for reliable agent workflows. The current design prefers dynamic discovery first, then uses curated authoritative fallbacks for docs roots, changelogs, and deprecation guides where needed.

That means:
- better real-world reliability
- fewer off-topic results
- stronger official-source guarantees
- less philosophical purity than a zero-registry design

## Star History

If NerdyGeek is useful, give it a star and help more agents stop coding from stale docs.

[![Star History Chart](https://api.star-history.com/svg?repos=docxbox/NerdyGeek&type=Date)](https://www.star-history.com/#docxbox/NerdyGeek&Date)

## License

[MIT](./LICENSE)
