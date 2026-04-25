---
description: Fetch live, version-aware official documentation for any language, framework, or library. Supports modes, version pinning, error-to-docs, diff, and deprecation scanning.
---

# NerdyGeek - Live Docs for Any Stack

Fetch fresh official docs instead of guessing from stale training data. Works for every language and ecosystem.

---

## Invocation

```
/docs [mode] <query>
/docs [mode] diff <pkg> <v1> <v2>
/docs scan [path]
```

**Default mode:** `full`  
**Switch modes:** `/docs quick ...` · `/docs full ...` · `/docs deep ...`  
Mode persists until changed or session ends.

---

## Modes

| Mode | What you get |
|---|---|
| `quick` | Signature + 1 example only. No prose. |
| `full` | Signature + params + example + gotchas + version *(default)* |
| `deep` | Full guide + edge cases + internals + alternatives + migration notes |

**Examples:**
```
/docs quick net/http HandleFunc
/docs full react useEffect
/docs deep next 14 server actions
```

---

## Step 1 - Version Pinning (always do this first)

Before fetching docs, check the project's lockfile to find the **exact version in use**. Read the first matching file found:

| File | How to read version |
|---|---|
| `package.json` | `dependencies` or `devDependencies` field |
| `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` | resolved version for the package |
| `go.mod` | `require` directive for the module |
| `Cargo.toml` / `Cargo.lock` | `[dependencies]` version |
| `requirements.txt` / `Pipfile` / `pyproject.toml` | pinned version |
| `Gemfile.lock` | pinned gem version |
| `pubspec.yaml` | Flutter/Dart dependency version |
| `pom.xml` / `build.gradle` | Java/Kotlin dependency version |
| `.nvmrc` / `.tool-versions` | Node/runtime version |

If a lockfile version is found -> fetch docs for **that version**, not latest.  
If no lockfile -> fetch latest, state `[version: latest]` in output.  
User can override: `/docs react@18.2.0 useEffect`

---

## Step 2 - Resolve the canonical docs URL

Try `search_docs` first. If it errors or returns off-topic content (trademark pages, unrelated sites, non-docs results) -> **do not retry** -> go straight to the table below.

| Stack | Canonical URL pattern |
|---|---|
| **Go stdlib** | `https://pkg.go.dev/<import-path>#Symbol` |
| **Go blog / spec** | `https://go.dev/blog/<slug>` · `https://go.dev/ref/spec` |
| **Rust std** | `https://doc.rust-lang.org/std/<module>/` |
| **Rust crate** | `https://docs.rs/<crate>/<version>/<crate>/` |
| **Python stdlib** | `https://docs.python.org/3/library/<module>.html` |
| **Python package** | `https://pypi.org/project/<pkg>/` -> follow "Documentation" link |
| **Node.js stdlib** | `https://nodejs.org/api/<module>.html` |
| **npm package** | `https://www.npmjs.com/package/<pkg>` -> follow repo/docs link |
| **React** | `https://react.dev/reference/react/<api>` |
| **Next.js** | `https://nextjs.org/docs/<slug>` |
| **Vue** | `https://vuejs.org/api/<section>` |
| **Svelte** | `https://svelte.dev/docs/<section>` |
| **Angular** | `https://angular.dev/api/<module>/<symbol>` |
| **Java (OpenJDK)** | `https://docs.oracle.com/en/java/javase/21/docs/api/<module>/<pkg>/Class.html` |
| **Kotlin** | `https://kotlinlang.org/api/latest/jvm/stdlib/<pkg>/` |
| **Swift** | `https://developer.apple.com/documentation/swift` |
| **C# / .NET** | `https://learn.microsoft.com/en-us/dotnet/api/<namespace>.<type>` |
| **PHP** | `https://www.php.net/manual/en/function.<name>.php` |
| **Ruby stdlib** | `https://ruby-doc.org/core/<Class>.html` |
| **Ruby gem** | `https://rubygems.org/gems/<gem>` -> follow docs link |
| **C / C++** | `https://en.cppreference.com/w/cpp/<header>/<symbol>` |
| **Zig std** | `https://ziglang.org/documentation/master/std/` |
| **Elixir / Erlang** | `https://hexdocs.pm/<pkg>/` |
| **Haskell** | `https://hackage.haskell.org/package/<pkg>/docs/<Module>.html` |
| **Dart / Flutter** | `https://api.dart.dev/stable/dart-<lib>/<lib>-library.html` |
| **PostgreSQL** | `https://www.postgresql.org/docs/current/<page>.html` |
| **MySQL** | `https://dev.mysql.com/doc/refman/8.0/en/<page>.html` |
| **Redis** | `https://redis.io/docs/latest/commands/<command>/` |
| **MongoDB** | `https://www.mongodb.com/docs/manual/reference/` |
| **Docker** | `https://docs.docker.com/reference/` |
| **Kubernetes** | `https://kubernetes.io/docs/reference/` |
| **Terraform** | `https://registry.terraform.io/providers/<org>/<provider>/latest/docs` |
| **GraphQL** | `https://graphql.org/learn/` |
| **gRPC** | `https://grpc.io/docs/languages/<lang>/` |
| **Anthropic / Claude API** | `https://docs.anthropic.com/en/api/<section>` |
| **OpenAI API** | `https://platform.openai.com/docs/api-reference/<section>` |
| **AWS SDK** | `https://docs.aws.amazon.com/sdk-for-<lang>/latest/developer-guide/` |

### Generic resolution (unlisted stacks)

1. `WebSearch`: `"<package> official documentation" site:docs.<name>.* OR site:<name>.dev OR site:<name>.io`
2. Pick first **official** result (not tutorials, Medium, Stack Overflow)
3. Use that URL with `WebFetch`

---

## Step 3 - Fetch with the right prompt per mode

```
quick:  "Extract only: function/method signature and one minimal working example."
full:   "Extract: signature, all parameters with types and defaults, return type, one working example, and any common gotchas or caveats."
deep:   "Extract: full API reference, all overloads, parameter details, return type, multiple examples covering edge cases, performance notes, common mistakes, alternatives, and any migration notes from previous versions."
```

---

## Step 4 - Output format (always use this exact structure)

```
[Docs] NerdyGeek  |  <Stack> <version>  |  <source URL>
======================================================

ANSWER   <one-line summary of what was found>

CODE
<working code snippet>

GOTCHA   <key caveat or common mistake - omit in quick mode>
SINCE    <version this API was introduced or last changed - omit in quick mode>
SOURCE   <exact URL fetched>
```

---

## Diff / Changelog mode

```
/docs diff <pkg> <v1> <v2>
/docs changelog <pkg>
```

**Examples:**
```
/docs diff react 18 19
/docs diff next 13 14
/docs changelog prisma
```

Procedure:
1. Fetch the official migration guide or changelog for the package
2. Extract: new APIs, removed/deprecated APIs, breaking changes, behaviour changes
3. Output using DIFF format:

```
[Docs] NerdyGeek  |  <pkg> <v1> -> <v2>  |  <source URL>
========================================================

NEW          <list of new APIs / features>
DEPRECATED   <list of deprecated APIs with replacements>
REMOVED      <list of removed APIs>
BREAKING     <behaviour changes that silently break existing code>
SOURCE       <exact URL>
```

---

## Deprecation Scanner

```
/docs scan [path]          # scans current file if no path given
/docs scan ./src
/docs scan ./components/Auth.tsx
```

Procedure:
1. Read the target file(s)
2. Identify every external API call, import, and method usage
3. For each unique package used, fetch its changelog/migration docs
4. Cross-reference: flag any call that is deprecated or removed in the version locked in the project's lockfile
5. Output:

```
[Docs] NerdyGeek  |  Deprecation Scan  |  <file path>
=====================================================

DEPRECATED   line 12  | <pkg>.<method>()  ->  use <replacement> instead
REMOVED      line 34  | <pkg>.<oldAPI>    ->  removed in <version>, use <replacement>
OK           <n> other API calls look current
SOURCE       <changelog URL>
```

If nothing deprecated: output `All APIs current as of <version>.`

---

## Error-to-Docs Bridge (passive, always active)

When an error appears in terminal output, test results, or code comments:
1. Identify the package/framework that threw it
2. Auto-resolve the docs URL for that package's error reference
3. Fetch the relevant error documentation without waiting to be asked
4. Prepend the docs context to the answer

Trigger patterns (auto-detect, no `/docs` needed):
- Stack traces with package names
- `Error: ...` / `TypeError: ...` / `panic: ...` / `exception: ...`
- Compiler errors referencing a specific module
- HTTP status errors from a named SDK

Output uses the same NerdyGeek format, prefixed with `Auto-fetched:`.

---

## Session Cache

Track docs fetched this session. If the same package+version is queried again -> reuse and append `[cached]` to the source line. No re-fetch needed.

---

## Override & Special Flags

| Flag | Behaviour |
|---|---|
| `react@18.2.0` | Pin to specific version, ignore lockfile |
| `/docs compare axios fetch` | Side-by-side syntax + tradeoffs for two options |
| `/docs inject` | After showing docs, offer to insert boilerplate scaffold at cursor |
| `stop docs` | Disable Error-to-Docs auto-trigger for this session |
