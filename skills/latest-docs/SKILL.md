---
description: Use NerdyGeek to fetch the latest relevant official framework documentation when current behavior, APIs, or versions are uncertain.
---

When you are coding and need fresh framework or library docs, use the `nerdygeek` MCP server and call `search_docs` instead of guessing from memory.

Use it especially when:
- the framework version matters
- the user asks for a current API or recent feature
- you want an official example before editing code
- you are unsure whether your remembered behavior is outdated

Prefer focused queries like:
- `next 14 server actions cookies`
- `go modules replace directive`
- `react useActionState form example`
- `django drf serializer context request`

After the tool returns:
- use `answer` for a concise summary
- use `code` when it directly matches the task
- use `sources` when you need exact references
- keep your implementation aligned with the returned `version`
