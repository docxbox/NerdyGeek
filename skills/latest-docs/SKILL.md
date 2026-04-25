---
description: Fetch live, version-aware official documentation for any language, framework, or library. Supports quick/full/deep modes, lockfile-based version pinning, changelog diffs, and deprecation scanning.
---

# NerdyGeek - Live Docs for Any Stack

The NerdyGeek MCP server exposes three tools. Use them directly - do not guess or use cached training knowledge when these tools can answer.

---

## Tool 1: `search_docs`

Fetches official documentation for a query. Automatically detects the stack and resolves the authoritative docs URL.

**Parameters:**
- `query` (required): what you need, e.g. `"net/http HandleFunc routing"`, `"react useEffect cleanup"`
- `mode` (optional): `"quick"` | `"full"` (default) | `"deep"`
- `packageJson` (optional): pass the project's package.json object for version pinning
- `lockfiles` (optional): object with any of `goMod`, `cargoToml`, `requirementsTxt`, `gemfileLock` as strings

**Modes:**
| Mode | What you get |
|---|---|
| `quick` | Signature + 1 example only |
| `full` | Signature + params + example + gotchas (default) |
| `deep` | Multiple examples, edge cases, internals, alternatives |

**When to pass lockfiles:** Always pass the relevant lockfile content when available - the server uses it to pin the version and fetch the exact docs the project is running against.

**Supported stacks (auto-detected):** Go, Rust, Python, Ruby, PHP, Java, Kotlin, Swift, C#/.NET, React, Next.js, Vue, Svelte, Angular, Django, Flask, FastAPI, Express, PostgreSQL, MySQL, Redis, MongoDB, Docker, Kubernetes, Terraform, GraphQL, gRPC, and any npm/PyPI package.

**Returns:** `{ stack, version, answer, code?, sources[], confidence }`

---

## Tool 2: `diff_docs`

Fetches the official changelog between two versions and returns a structured list of changes.

**Parameters:**
- `stack` (required): e.g. `"react"`, `"nextjs"`, `"go"`, `"django"`
- `fromVersion` (required): e.g. `"18"`
- `toVersion` (required): e.g. `"19"`

**Returns:** `{ stack, fromVersion, toVersion, changes[], sources[] }`

Each change has `type` (`"new"` | `"deprecated"` | `"removed"` | `"breaking"`) and `description`. Deprecated/removed entries include a `replacement` when available.

**Use when:** user asks what changed between versions, wants a migration guide, or is upgrading a dependency.

---

## Tool 3: `scan_deprecations`

Scans a file's source code against the stack's official deprecation/migration docs and returns matches with line numbers.

**Parameters:**
- `fileContent` (required): the full source code as a string
- `stack` (required): e.g. `"react"`, `"go"`, `"python"`
- `version` (optional): the version in use (defaults to "latest")

**Returns:** `{ stack, version, deprecated[], removed[], sources[] }`

Each match has `line`, `api`, `reason`, and optional `replacement`.

**Use when:** user asks to scan a file for outdated APIs, before a major version upgrade, or when `search_docs` returns a deprecation warning about something in the current file.

---

## How to use these tools

### Basic lookup
```
search_docs({ query: "net/http ServeMux routing" })
search_docs({ query: "react useEffect cleanup", mode: "quick" })
search_docs({ query: "next 14 server actions cookies", mode: "deep" })
```

### With version pinning from lockfile
Read the lockfile first, then pass its content:
```
search_docs({
  query: "django ORM queryset filtering",
  lockfiles: { requirementsTxt: "<contents of requirements.txt>" }
})

search_docs({
  query: "tokio async runtime",
  lockfiles: { cargoToml: "<contents of Cargo.toml>" }
})
```

### Diff between versions
```
diff_docs({ stack: "react", fromVersion: "18", toVersion: "19" })
diff_docs({ stack: "nextjs", fromVersion: "13", toVersion: "14" })
diff_docs({ stack: "go", fromVersion: "1.21", toVersion: "1.22" })
```

### Scan a file for deprecated APIs
Read the file first, then pass its content:
```
scan_deprecations({
  fileContent: "<file source>",
  stack: "react",
  version: "19"
})
```

---

## Output format

Always present tool results using this structure:

```
[Docs] NerdyGeek  |  <stack> <version>  |  <source URL>
======================================================

ANSWER   <summary from result.answer>

CODE
<code from result.code if present>

SOURCE   <result.sources[0]>
```

For `diff_docs`, group changes by type:
```
[Docs] NerdyGeek  |  <stack> <fromVersion> -> <toVersion>
==========================================================

NEW          - <description>
DEPRECATED   - <description>  ->  <replacement if any>
REMOVED      - <description>  ->  <replacement if any>
BREAKING     - <description>
SOURCE       <url>
```

For `scan_deprecations`:
```
[Docs] NerdyGeek  |  Deprecation Scan  |  <stack> <version>
============================================================

DEPRECATED   line <n>  |  <api>  ->  <replacement>
REMOVED      line <n>  |  <api>  ->  <replacement>
OK           <n> other API calls checked, none flagged
SOURCE       <url>
```

If scan returns no matches: output `All APIs current as of <version>`.

---

## Fallback when tools fail

If a tool call errors or returns clearly off-topic content:
1. Do not retry the same call.
2. Use `WebSearch` to find the official docs URL: `"<stack> official documentation site:<stack>.dev OR site:docs.<stack>.org"`
3. Use `WebFetch` on that URL with a focused extraction prompt.
4. Present the result in the same output format above.
