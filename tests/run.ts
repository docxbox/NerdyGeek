import assert from "node:assert/strict";
import { SemanticCache } from "../src/cache.js";
import { detectStack } from "../src/detector.js";
import { searchQueriesForTesting } from "../src/discovery.js";
import { extract, extractRelevantCodeBlocks } from "../src/extractor.js";
import { rankChunks } from "../src/ranker.js";
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

  console.log("All tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
