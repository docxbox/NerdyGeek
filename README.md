# NerdyGeek

Production-ready TypeScript MCP server and Claude bundle exposing a single tool: `search_docs`.

It auto-detects frameworks from the query and optional `packageJson`, discovers official docs dynamically, resolves version context, retrieves and ranks documentation, validates the final response, and returns deterministic structured output.

## Tool

`search_docs`

Input:

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

Output:

```json
{
  "stack": "nextjs",
  "version": "14",
  "answer": "nextjs 14: ...",
  "code": "optional code sample",
  "sources": [
    "https://nextjs.org/docs"
  ],
  "confidence": 0.85
}
```

## Run

Install and build:

```bash
npm install
npm run build
```

Local stdio MCP server:

```bash
npm start
```

Remote/HTTP MCP server:

```bash
npm run start:http
```

The HTTP MCP endpoint is:

```text
http://127.0.0.1:3000/mcp
```

## Local Install

For open-source local use, the intended flow is:

```bash
npm install
npm run build
```

Then install for your coding agent:

| Agent | Install |
|---|---|
| Claude Code | `npm run install:claude-code` |
| Codex | `npm run install:codex` |
| Both | `npm run install:all` |

What these do:

- `Claude Code`: writes a project `.mcp.json` pointing at `dist/src/stdio.js`
- `Codex`: updates `~/.codex/config.toml` with `http://127.0.0.1:3000/mcp` and creates a local launcher script at [scripts/start-codex-local.ps1](C:/Users/acer/Downloads/NerdyGeek/scripts/start-codex-local.ps1)

For Codex local use, start the local MCP server after install:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-codex-local.ps1
```

## Claude Code Marketplace

This repo is now structured as a Claude Code plugin marketplace:

- marketplace catalog: [.claude-plugin/marketplace.json](C:/Users/acer/Downloads/NerdyGeek/.claude-plugin/marketplace.json)
- plugin manifest: [.claude-plugin/plugin.json](C:/Users/acer/Downloads/NerdyGeek/.claude-plugin/plugin.json)
- bundled plugin skill: [skills/latest-docs/SKILL.md](C:/Users/acer/Downloads/NerdyGeek/skills/latest-docs/SKILL.md)

Once this repository is published, Claude Code users can install it with:

```bash
claude plugin marketplace add <owner>/<repo>
claude plugin install nerdygeek@nerdygeek
```

If you submit it to Anthropic’s official marketplace, the same plugin package can be used there as well.

## Claude Desktop

Example local MCP config:

```json
{
  "mcpServers": {
    "nerdygeek": {
      "command": "node",
      "args": ["C:\\\\Users\\\\acer\\\\Downloads\\\\NerdyGeek\\\\dist\\\\src\\\\stdio.js"],
      "env": {}
    }
  }
}
```

## Claude Code

Claude Code supports project-scoped MCP servers through `.mcp.json`.

This repo now includes a ready-to-use project config at [.mcp.json](C:/Users/acer/Downloads/NerdyGeek/.mcp.json):

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

Build first, then open the repo in Claude Code:

```bash
npm run build
```

You can also use the absolute-path example in [examples/claude-code.mcp.json](C:/Users/acer/Downloads/NerdyGeek/examples/claude-code.mcp.json).

If you want users to always hit the latest hosted server instead of a local build, use an HTTP MCP config like [examples/claude-code.remote.mcp.json](C:/Users/acer/Downloads/NerdyGeek/examples/claude-code.remote.mcp.json):

```json
{
  "mcpServers": {
    "nerdygeek": {
      "type": "http",
      "url": "https://your-domain.example.com/mcp"
    }
  }
}
```

## Codex

Example Codex config using the HTTP MCP endpoint:

```toml
[mcp_servers.nerdygeek]
url = "http://127.0.0.1:3000/mcp"
```

For a hosted public deployment, use [examples/codex-config.public.toml](C:/Users/acer/Downloads/NerdyGeek/examples/codex-config.public.toml):

```toml
[mcp_servers.nerdygeek]
url = "https://your-domain.example.com/mcp"
```

## Scripts

- `npm run build`
- `npm start`
- `npm run start:http`
- `npm run bundle`
- `npm run install:claude-code`
- `npm run install:codex`
- `npm run install:all`
- `npm test`

## MCP Bundle

`npm run bundle` creates a Claude Desktop `.mcpb` bundle in `artifacts/`.

## Client Matrix

- `Claude Code`: run `npm run install:claude-code`
- `Claude Desktop`: install [artifacts/nerdygeek-1.0.0.mcpb](C:/Users/acer/Downloads/NerdyGeek/artifacts/nerdygeek-1.0.0.mcpb)
- `Codex`: run `npm run install:codex`, then start the local HTTP MCP

## Public Deployment

If you want `NerdyGeek` to stay current for both Claude and Codex users, publish the HTTP MCP server and give clients a stable HTTPS URL such as:

```text
https://your-domain.example.com/mcp
```

That avoids stale local bundles and old checked-in configs. In practice:

- `Codex`: point `mcp_servers.nerdygeek.url` at the public URL
- `Claude Code`: use an HTTP `.mcp.json` entry pointing at the same URL
- `Claude Desktop`: prefer a remote MCP config if you want users to always get the latest server behavior; use the `.mcpb` bundle when you want a packaged local install

Recommended production safeguards for a public MCP:

- HTTPS only
- request logging with redaction
- per-IP rate limiting
- timeouts on fetch and search
- clear `User-Agent`
- health endpoint monitoring
- stable hostname so users do not keep changing configs
