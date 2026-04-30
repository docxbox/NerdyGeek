# NerdyGeek
<img width="400" height="400" alt="NerdyGeek" src="https://github.com/user-attachments/assets/0ece259c-f69b-4084-af85-f850b6e2c219" />

> A docs-intelligence layer for coding agents.

[![Claude Code Marketplace](https://img.shields.io/badge/Claude%20Code-Published-blue)](https://github.com/docxbox/NerdyGeek)
[![MCP Server](https://img.shields.io/badge/MCP-Server-black)](https://modelcontextprotocol.io/)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/docxbox/NerdyGeek?style=social)](https://github.com/docxbox/NerdyGeek/stargazers)

NerdyGeek is an open-source TypeScript Node.js MCP server and Claude Code plugin that helps coding agents stop guessing from stale memory.

When an agent gets stuck, NerdyGeek helps it:
- fetch current official documentation
- resolve version context from project files
- compare framework upgrades
- scan for deprecated or removed APIs
- return compressed, source-backed answers instead of dumping long docs into context

NerdyGeek is now successfully published in the Claude Code marketplace and also works with Codex and local MCP-based workflows.

## Why NerdyGeek Exists

Coding agents move fast, but documentation drift is real.

The moment version details matter, or a framework changes behavior, agents often:
- guess from memory
- pull noisy search results
- use the wrong version of the docs
- miss migration and deprecation details

NerdyGeek exists to make agents behave more like careful engineers:
- source-backed
- version-aware
- token-conscious
- conservative when uncertain

## Core Capabilities

NerdyGeek currently exposes three MCP tools:

- `search_docs`
- `diff_docs`
- `scan_deprecations`

### `search_docs`

Version-aware official documentation lookup for frameworks, libraries, and APIs.

Use it when an agent needs:
- the latest official docs for a feature
- docs pinned to the version in the repo
- examples, gotchas, and source links

### `diff_docs`

Structured upgrade and migration comparison between versions.

Use it when an agent needs:
- breaking changes
- removed APIs
- deprecated APIs
- migration guidance before an upgrade

### `scan_deprecations`

Source-code scan against official migration or deprecation docs.

Use it when an agent needs:
- outdated API detection
- upgrade prep before a version bump
- line-level findings for deprecated or removed usage

## Shared Response Contract

All tools now return a shared agent-facing envelope:

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

<img width="1072" height="768" alt="NerdyGeek output example 1" src="https://github.com/user-attachments/assets/78268d4b-4ecb-4075-a718-8db1821dfe45" />

<img width="1085" height="868" alt="NerdyGeek output example 2" src="https://github.com/user-attachments/assets/a57a0ee4-a805-49c2-b916-992827487236" />

This lets agents consume NerdyGeek results in a predictable, low-noise, token-efficient format.

## What Makes NerdyGeek Different

NerdyGeek uses a hybrid docs-intelligence approach:
- dynamic discovery and ranking when that is reliable
- curated authoritative fallbacks when ecosystems are noisy or ambiguous

That tradeoff gives you:
- stronger official-source guarantees
- better reliability in real coding sessions
- fewer off-topic or SEO-polluted results
- less philosophical purity than a zero-registry design, but much better practical outcomes

## V4-Oriented Features

NerdyGeek now includes a more infrastructure-style layer on top of its MCP tools:

- shared response envelope across tools
- persistent on-disk cache in `.nerdygeek/store.json`
- reusable `docHandle` values for repeated lookups
- cache hit/miss tracking
- HTTP rate limiting for hosted mode
- `/health`, `/ready`, and `/metrics` endpoints
- structured logging

It is not the final word in production hardening yet, but it is well beyond a simple prototype plugin.

## Install

### Claude Code Marketplace

NerdyGeek is published for Claude Code.

```bash
claude plugin marketplace add docxbox/NerdyGeek
claude plugin install nerdygeek@nerdygeek
```

To update later:

```bash
claude plugin marketplace update nerdygeek
claude plugin update nerdygeek@nerdygeek
```

### Local Install

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
2. Resolve version context from the query, `package.json`, and supported lockfiles
3. Discover official docs dynamically when possible
4. Fall back to curated authoritative URLs when discovery is unreliable
5. Retrieve relevant pages
6. Extract clean text and code
7. Rank chunks deterministically
8. Format results into a shared agent envelope
9. Persist by cache key and `docHandle`
10. Validate before returning

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

## Current Direction

The long-term vision is to make NerdyGeek feel less like a docs tool and more like a **NerdyGeek engineer**:
- knows when to stop guessing
- fetches the right docs before risky edits
- preserves tokens through compression and cache reuse
- stays aligned with the actual version in the repo
- helps agents keep shipping without hallucinating

That is the standard this project is moving toward.

## Star History

If NerdyGeek is useful, give it a star and help more agents stop coding from stale docs.

[![Star History Chart](https://api.star-history.com/svg?repos=docxbox/NerdyGeek&type=Date)](https://www.star-history.com/#docxbox/NerdyGeek&Date)

## License

[MIT](./LICENSE)
