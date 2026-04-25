import assert from "node:assert/strict";
import { SemanticCache } from "../src/cache.js";
import { detectStack } from "../src/detector.js";
import { directProbeUrlsForTesting, discoverChangelogUrl, discoverDeprecationUrl, searchQueriesForTesting } from "../src/discovery.js";
import { chooseBestDiffDocument, classifyChunk, extractStructuredDiffEntries } from "../src/diffDocs.js";
import { extract, extractRelevantCodeBlocks } from "../src/extractor.js";
import { rankChunks } from "../src/ranker.js";
import { extractApiCalls, matchDeprecation } from "../src/scanDeprecations.js";
import { isLikelyOfficialSourceUrl } from "../src/utils.js";
import { validate } from "../src/validation.js";
import { resolveVersion } from "../src/version.js";
import { cacheKey } from "../src/utils.js";

async function main(): Promise<void> {
  const stacks = detectStack("How do server actions work in Next 14 app router?", {
    dependencies: {
      next: "^14.2.1",
      react: "^18.2.0"
    }
  });
  assert.equal(stacks[0], "nextjs");
  assert.ok(stacks.includes("react"));

  const goStacks = detectStack("How do goroutines work in Go?", undefined);
  assert.equal(goStacks[0], "go");

  const goQueries = searchQueriesForTesting("go");
  assert.ok(goQueries.includes("go programming language official documentation"));
  assert.ok(goQueries.includes("go programming language docs"));
  const goProbeUrls = directProbeUrlsForTesting("go");
  assert.ok(goProbeUrls.includes("https://go.dev/doc"));
  assert.ok(goProbeUrls.includes("https://go.dev/"));
  assert.equal(isLikelyOfficialSourceUrl("https://go.dev/blog/routing-enhancements"), true);
  assert.equal(isLikelyOfficialSourceUrl("https://dev.to/someone/go-routing"), false);

  const nextQueries = searchQueriesForTesting("nextjs");
  assert.ok(nextQueries.includes("next.js official documentation"));
  assert.ok(nextQueries.includes("next docs"));

  assert.equal(
    resolveVersion("nextjs", "next 14.2.1 server actions docs", {
      dependencies: {
        next: "^13.5.0"
      }
    }),
    "14"
  );

  const key = cacheKey("react", "18", "react hooks docs");
  assert.equal(key.length, 24);
  assert.equal(key, cacheKey("react", "18", "react hooks docs"));

  const cache = new SemanticCache();
  cache.setCache(
    key,
    {
      stack: "react",
      version: "18",
      answer: "React 18 docs explain hooks and rendering behavior clearly.",
      sources: ["https://react.dev/reference/react"],
      confidence: 0.85
    },
    10
  );
  assert.ok(cache.getCache(key));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(cache.getCache(key), null);

  const html = `
    <html>
      <body>
        <nav>Navigation menu</nav>
        <main>
          <h1>React Hooks</h1>
          <p>Hooks let you use state and other React features without writing a class.</p>
          <p>This page explains the rules of hooks and common patterns in detail.</p>
        </main>
        <footer>Footer links</footer>
      </body>
    </html>
  `;

  const chunks = extract(html);
  assert.equal(chunks.some((line) => line.includes("Navigation menu")), false);
  assert.ok(chunks.some((line) => line.includes("Hooks let you use state")));

  const ranked = rankChunks(
    [
      {
        url: "https://react.dev/reference/react",
        sourceType: "official",
        html
      },
      {
        url: "https://blog.example.dev/react-hooks-overview",
        sourceType: "blog",
        html: `<html><body><main><p>Hooks overview with opinions and deprecated advice.</p></main></body></html>`
      }
    ],
    "react hooks"
  );
  assert.equal(ranked[0]?.sourceType, "official");

  const nextRanked = rankChunks(
    [
      {
        url: "https://nextjs.org/docs/app/api-reference/functions/cookies",
        sourceType: "official",
        html: `
          <html><body><main>
            <p>The cookies function allows you to read the HTTP incoming request cookies in Server Components, and read or write outgoing request cookies in Server Actions or Route Handlers.</p>
          </main></body></html>
        `
      },
      {
        url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions",
        sourceType: "official",
        html: `
          <html><body><main>
            <p>You can configure serverActions.allowedOrigins in next.config.js to allow specific origins.</p>
          </main></body></html>
        `
      }
    ],
    "next 14 cookies() server actions app router"
  );
  assert.equal(nextRanked[0]?.url, "https://nextjs.org/docs/app/api-reference/functions/cookies");

  const codeBlocks = extractRelevantCodeBlocks(`
    <html><body><main>
      <pre><code>module.exports = { experimental: { serverActions: { allowedOrigins: ['my-proxy.com'] } } }</code></pre>
      <pre><code>'use server'
import { cookies } from 'next/headers'
export async function create() {
  const cookieStore = await cookies()
  cookieStore.set('name', 'lee')
}</code></pre>
    </main></body></html>
  `);
  assert.equal(codeBlocks.length >= 2, true);

  assert.throws(() =>
    validate({
      stack: "react",
      version: "18",
      answer: "<div>bad html</div>",
      sources: ["https://react.dev/reference/react"],
      confidence: 0.85
    })
  );

  assert.doesNotThrow(() =>
    validate({
      stack: "go",
      version: "1",
      answer: "go 1: ServeMux routing enhancements are documented on the official Go website.",
      sources: ["https://go.dev/blog/routing-enhancements"],
      confidence: 0.82
    })
  );

  // --- detector: expanded stacks ---
  assert.equal(detectStack("net/http ServeMux routing")[0], "go");
  assert.equal(detectStack("gorilla mux handler")[0], "go");
  assert.equal(detectStack("tokio async runtime rust")[0], "rust");
  assert.equal(detectStack("cargo crate lifetime trait")[0], "rust");
  assert.equal(detectStack("python asyncio event loop")[0], "python");
  assert.equal(detectStack("vue composition api ref reactive")[0], "vue");
  assert.equal(detectStack("svelte store writable")[0], "svelte");
  assert.equal(detectStack("angular injectable ngmodule")[0], "angular");
  assert.equal(detectStack("postgres pg query index")[0], "postgres");
  assert.equal(detectStack("redis pubsub stream command")[0], "redis");
  assert.equal(detectStack("kubernetes kubectl pod deployment")[0], "kubernetes");
  assert.equal(detectStack("grpc protobuf service stream")[0], "grpc");

  // --- version: lockfile sources ---
  assert.equal(
    resolveVersion("go", "net/http routing", undefined, { goMod: "module myapp\n\ngo 1.22\n" }),
    "1"
  );
  assert.equal(
    resolveVersion("tokio", "tokio async", undefined, {
      cargoToml: '[dependencies]\ntokio = { version = "1.28.0", features = ["full"] }\n'
    }),
    "1"
  );
  assert.equal(
    resolveVersion("flask", "flask route", undefined, {
      requirementsTxt: "Flask==3.0.2\nrequests>=2.31.0\n"
    }),
    "3"
  );
  assert.equal(
    resolveVersion("rails", "activerecord", undefined, {
      gemfileLock: "GEM\n  specs:\n    rails (7.1.3)\n    rake (13.0.6)\n"
    }),
    "7"
  );

  // --- classifyChunk ---
  assert.equal(classifyChunk("This method was deprecated in React 18."), "deprecated");
  assert.equal(classifyChunk("The legacy API has been removed in version 19."), "removed");
  assert.equal(classifyChunk("This is a breaking change introduced in 2.0."), "breaking");
  assert.equal(classifyChunk("Added support for concurrent rendering."), "new");
  assert.equal(classifyChunk("This is an unrelated sentence about the weather."), null);

  const bestDiffDocument = chooseBestDiffDocument(
    [
      {
        url: "https://react.dev/blog",
        sourceType: "official",
        html: `
          <html><body><main>
            <p>Read more about React 19 and other updates on the React blog.</p>
            <p>Anything important will be posted here first.</p>
          </main></body></html>
        `
      },
      {
        url: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
        sourceType: "official",
        html: `
          <html><body><main>
            <h1>React 19 Upgrade Guide</h1>
            <p>The improvements added to React 19 require some breaking changes.</p>
            <p>This migration guide explains deprecated and removed APIs when upgrading from React 18 to React 19.</p>
          </main></body></html>
        `
      }
    ],
    "react",
    "18",
    "19"
  );
  assert.equal(bestDiffDocument?.url, "https://react.dev/blog/2024/04/25/react-19-upgrade-guide");

  const structuredEntries = extractStructuredDiffEntries(`
    <html><body><main>
      <h1>React 19 Upgrade Guide</h1>
      <h2>New Features</h2>
      <ul>
        <li>ref as a prop is now supported.</li>
      </ul>
      <h2>Deprecated APIs</h2>
      <ul>
        <li>react-test-renderer is deprecated.</li>
      </ul>
      <h2>Removed APIs</h2>
      <ul>
        <li>ReactDOM.render has been removed.</li>
      </ul>
      <h2>Breaking Changes</h2>
      <p>Errors are no longer re-thrown after they are caught.</p>
    </main></body></html>
  `);
  assert.ok(structuredEntries.some((entry) => entry.type === "new" && entry.description.includes("ref as a prop")));
  assert.ok(structuredEntries.some((entry) => entry.type === "deprecated" && entry.description.includes("react-test-renderer")));
  assert.ok(structuredEntries.some((entry) => entry.type === "removed" && entry.description.includes("ReactDOM.render")));
  assert.ok(structuredEntries.some((entry) => entry.type === "breaking" && entry.description.includes("no longer re-thrown")));

  // --- extractApiCalls ---
  const sampleCode = `
import { useState, useEffect } from 'react';
import axios from 'axios';
const data = axios.get('/api');
class MyComponent extends React.Component {
  render() { return null; }
}
`.trim();
  const calls = extractApiCalls(sampleCode);
  const names = calls.map((c) => c.name);
  assert.ok(names.includes("useState"));
  assert.ok(names.includes("useEffect"));
  assert.ok(names.includes("axios.get"));

  // --- matchDeprecation ---
  const deprecationDoc = `
    The componentWillMount lifecycle method is deprecated, use componentDidMount instead.
    The findDOMNode method has been removed in React 19.
    The legacy Context API is deprecated and will be removed in a future version.
  `;
  const match1 = matchDeprecation("componentWillMount", deprecationDoc);
  assert.ok(match1 !== null, "componentWillMount should match deprecation");
  assert.equal(match1?.replacement, "componentDidMount");

  const match2 = matchDeprecation("findDOMNode", deprecationDoc);
  assert.ok(match2 !== null, "findDOMNode should match removal");

  const noMatch = matchDeprecation("useState", deprecationDoc);
  assert.equal(noMatch, null, "useState should not match deprecation");

  // --- discoverChangelogUrl / discoverDeprecationUrl use central registry ---
  assert.equal(await discoverChangelogUrl("go"), "https://go.dev/doc/devel/release");
  assert.equal(await discoverChangelogUrl("react"), "https://react.dev/blog");
  assert.equal(await discoverDeprecationUrl("react"), "https://react.dev/blog/2024/04/25/react-19-upgrade-guide");
  assert.equal(await discoverDeprecationUrl("kubernetes"), "https://kubernetes.io/docs/reference/using-api/deprecation-guide/");

  console.log("All tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
