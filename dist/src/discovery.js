import * as cheerio from "cheerio";
import { fetchWithTimeout } from "./http.js";
import { normalizeText, safeHostname, sanitizeFrameworkName, unique } from "./utils.js";
const discouragedHostsPattern = /(medium\.com|dev\.to|stackoverflow\.com|reddit\.com|wikipedia\.org)/i;
// Authoritative doc roots for stacks where DuckDuckGo discovery is unreliable.
// Keyed by the stack name returned by detectStack().
const knownDocUrls = {
    go: "https://pkg.go.dev/std",
    rust: "https://doc.rust-lang.org/std/",
    python: "https://docs.python.org/3/",
    ruby: "https://ruby-doc.org/core/",
    php: "https://www.php.net/manual/en/",
    java: "https://docs.oracle.com/en/java/javase/21/docs/api/",
    kotlin: "https://kotlinlang.org/docs/home.html",
    swift: "https://developer.apple.com/documentation/swift",
    csharp: "https://learn.microsoft.com/en-us/dotnet/csharp/",
    react: "https://react.dev/reference/react",
    nextjs: "https://nextjs.org/docs",
    vue: "https://vuejs.org/guide/introduction",
    svelte: "https://svelte.dev/docs/introduction",
    angular: "https://angular.dev/overview",
    django: "https://docs.djangoproject.com/en/stable/",
    flask: "https://flask.palletsprojects.com/en/stable/",
    fastapi: "https://fastapi.tiangolo.com/reference/",
    express: "https://expressjs.com/en/api.html",
    postgres: "https://www.postgresql.org/docs/current/",
    mysql: "https://dev.mysql.com/doc/refman/8.0/en/",
    redis: "https://redis.io/docs/latest/",
    mongodb: "https://www.mongodb.com/docs/manual/",
    docker: "https://docs.docker.com/reference/",
    kubernetes: "https://kubernetes.io/docs/reference/",
    terraform: "https://developer.hashicorp.com/terraform/docs",
    graphql: "https://graphql.org/learn/",
    grpc: "https://grpc.io/docs/"
};
// For Go import paths in queries (e.g. "net/http", "encoding/json"),
// resolve directly to pkg.go.dev instead of the generic std page.
function resolveGoImportPath(query) {
    const goImportPattern = /\b(net\/[a-z]+|encoding\/[a-z]+|crypto\/[a-z]+|os|fmt|io(?:\/[a-z]+)?|bufio|bytes|strings|strconv|sync(?:\/[a-z]+)?|context|errors|log(?:\/[a-z]+)?|math(?:\/[a-z]+)?|path(?:\/[a-z]+)?|regexp|sort|time|unicode(?:\/[a-z]+)?|database\/sql|html\/template|text\/template)\b/i;
    const match = query.match(goImportPattern);
    if (match) {
        return `https://pkg.go.dev/${(match[1] ?? "std").toLowerCase()}`;
    }
    return null;
}
const discouragedMirrorPattern = /\b(mirror|mirrors|translated|translation|community|community-maintained|unofficial|archive|fork)\b/i;
const likelyOfficialTldPattern = /\.(org|dev|io|com|app|net|build|js|rs|sh)$/i;
const directProbeTlds = ["dev", "org", "io", "com", "app", "net", "build", "js", "rs", "sh"];
const directProbePaths = ["/docs", "/doc", "/reference", "/learn", "/"];
function frameworkVariants(frameworkName) {
    const sanitized = sanitizeFrameworkName(frameworkName).replace(/\s+/g, " ").trim();
    const compact = sanitized.replace(/\s+/g, "");
    const variants = new Set([frameworkName, sanitized, compact]);
    if (compact.endsWith("js") && compact.length > 2) {
        const stem = compact.slice(0, -2);
        variants.add(`${stem}.js`);
        variants.add(`${stem} js`);
        variants.add(stem);
    }
    if (compact.length <= 3) {
        variants.add(`${compact} language`);
        variants.add(`${compact} programming language`);
    }
    return [...variants].map((value) => normalizeText(value)).filter((value) => value.length > 0);
}
function searchQueries(frameworkName) {
    const aliases = unique(frameworkVariants(frameworkName));
    return unique(aliases.flatMap((alias) => [
        `${alias} official documentation`,
        `${alias} docs`,
        `${alias} API reference`,
        `${alias} official docs`
    ]));
}
function hostLabels(frameworkName) {
    const labels = new Set();
    for (const variant of frameworkVariants(frameworkName)) {
        const compact = variant.replace(/[^a-z0-9]/g, "");
        const dashed = variant.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        if (compact.length >= 2) {
            labels.add(compact);
        }
        if (dashed.length >= 2) {
            labels.add(dashed);
        }
    }
    return [...labels].sort((a, b) => a.length - b.length || a.localeCompare(b)).slice(0, 6);
}
function directProbeUrls(frameworkName) {
    const urls = [];
    for (const label of hostLabels(frameworkName)) {
        for (const tld of directProbeTlds) {
            const base = `https://${label}.${tld}`;
            for (const path of directProbePaths) {
                urls.push(`${base}${path}`);
            }
        }
    }
    return unique(urls);
}
function normalizeSearchUrl(rawUrl) {
    try {
        const candidate = new URL(rawUrl, "https://html.duckduckgo.com");
        const redirectTarget = candidate.searchParams.get("uddg");
        return redirectTarget ? decodeURIComponent(redirectTarget) : candidate.toString();
    }
    catch {
        return rawUrl;
    }
}
function scoreResult(frameworkName, result) {
    const url = result.url.toLowerCase();
    const title = result.title.toLowerCase();
    const snippet = result.snippet.toLowerCase();
    const hostname = safeHostname(result.url);
    const variants = frameworkVariants(frameworkName).map((value) => value.toLowerCase());
    const sanitizedFramework = sanitizeFrameworkName(frameworkName).replace(/\s+/g, "");
    const hostCompact = hostname.replace(/[^a-z0-9]/g, "");
    const combined = `${title} ${snippet} ${url}`;
    let score = 0;
    if (url.includes("docs")) {
        score += 5;
    }
    if (url.includes("official") || title.includes("official")) {
        score += 5;
    }
    if (hostname.includes("github.com")) {
        const pathSegments = new URL(result.url).pathname.split("/").filter(Boolean);
        if (pathSegments[0]?.toLowerCase().replace(/[^a-z0-9]/g, "").includes(sanitizedFramework)) {
            score += 3;
        }
    }
    if (hostCompact.includes(sanitizedFramework)) {
        score += 4;
    }
    if (variants.some((variant) => combined.includes(variant))) {
        score += 4;
    }
    if (title.includes("documentation") || title.includes("docs")) {
        score += 2;
    }
    if (snippet.includes("documentation") || snippet.includes("reference")) {
        score += 2;
    }
    if (discouragedHostsPattern.test(hostname)) {
        score -= 3;
    }
    if (/(docs|developer|reference|guide)/.test(hostname)) {
        score += 2;
    }
    if (/(blog|news|tutorial)/.test(url)) {
        score -= 2;
    }
    if (likelyOfficialTldPattern.test(hostname)) {
        score += 2;
    }
    if (discouragedMirrorPattern.test(`${title} ${snippet} ${url}`)) {
        score -= 12;
    }
    return score;
}
async function scoreResolvedPage(frameworkName, candidate) {
    let score = candidate.score + candidate.hits * 2;
    const framework = sanitizeFrameworkName(frameworkName).replace(/\s+/g, "");
    const variants = frameworkVariants(frameworkName).map((value) => value.toLowerCase());
    const hostname = candidate.hostname;
    if (hostname.replace(/^www\./, "") === `${framework}.org`) {
        score += 8;
    }
    if (hostname.replace(/^www\./, "") === `${framework}.dev`) {
        score += 8;
    }
    if (hostname.includes(framework) && likelyOfficialTldPattern.test(hostname)) {
        score += 5;
    }
    try {
        const response = await fetchWithTimeout(candidate.url);
        if (!response.ok) {
            return score;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const title = normalizeText($("title").first().text()).toLowerCase();
        const metaDescription = normalizeText($("meta[name='description']").attr("content") ?? "").toLowerCase();
        const ogSiteName = normalizeText($("meta[property='og:site_name']").attr("content") ?? "").toLowerCase();
        const ogTitle = normalizeText($("meta[property='og:title']").attr("content") ?? "").toLowerCase();
        const canonical = ($("link[rel='canonical']").attr("href") ?? "").toLowerCase();
        const bodyText = normalizeText($("main, article, body").first().text()).toLowerCase().slice(0, 4000);
        const combined = `${title} ${metaDescription} ${ogSiteName} ${ogTitle} ${canonical} ${bodyText}`;
        if (variants.some((variant) => combined.includes(variant))) {
            score += 8;
        }
        if (combined.includes(framework)) {
            score += 4;
        }
        if (combined.includes("official documentation") || combined.includes("official docs")) {
            score += 8;
        }
        if (combined.includes("api reference") || combined.includes("reference")) {
            score += 3;
        }
        if (combined.includes("documentation") &&
            (combined.includes("language spec") ||
                combined.includes("standard library") ||
                combined.includes("package documentation") ||
                combined.includes("get started"))) {
            score += 4;
        }
        if (canonical.includes("/doc") || canonical.includes("/docs") || canonical.includes("/reference")) {
            score += 3;
        }
        if (discouragedMirrorPattern.test(combined)) {
            score -= 20;
        }
    }
    catch {
        return score;
    }
    return score;
}
async function scoreDirectProbe(frameworkName, url) {
    const hostname = safeHostname(url);
    const path = new URL(url).pathname.toLowerCase();
    const candidate = {
        url,
        title: "",
        snippet: "",
        hostname,
        score: 0,
        hits: 0
    };
    let score = await scoreResolvedPage(frameworkName, candidate);
    if (path === "/docs" || path === "/doc" || path === "/reference") {
        score += 5;
    }
    else if (path === "/learn") {
        score += 3;
    }
    else if (path === "/") {
        score += 1;
    }
    return score;
}
async function searchDuckDuckGo(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    $(".result").each((_, element) => {
        const link = $(element).find(".result__title a").first();
        const title = normalizeText(link.text());
        const href = normalizeSearchUrl(link.attr("href")?.trim() ?? "");
        const snippet = normalizeText($(element).find(".result__snippet").text());
        if (!title || !href) {
            return;
        }
        results.push({
            title,
            url: href,
            snippet,
            score: 0
        });
    });
    return results;
}
export async function discoverFrameworkDocs(frameworkName, query) {
    // For Go, try to resolve a specific import-path URL first.
    if (frameworkName === "go" && query) {
        const importUrl = resolveGoImportPath(query);
        if (importUrl) {
            return importUrl;
        }
    }
    // Use a known authoritative URL when available — avoids unreliable search results.
    const knownUrl = knownDocUrls[frameworkName.toLowerCase()];
    if (knownUrl) {
        return knownUrl;
    }
    const rankedCandidates = new Map();
    for (const query of searchQueries(frameworkName)) {
        let results = [];
        try {
            results = await searchDuckDuckGo(query);
        }
        catch {
            continue;
        }
        for (const result of results) {
            const score = scoreResult(frameworkName, result);
            const hostname = safeHostname(result.url);
            const existing = rankedCandidates.get(hostname);
            if (!existing || score > existing.score) {
                rankedCandidates.set(hostname, {
                    ...result,
                    hostname,
                    score,
                    hits: (existing?.hits ?? 0) + 1
                });
            }
            else {
                existing.hits += 1;
            }
        }
    }
    const rescored = await Promise.all([...rankedCandidates.values()]
        .filter((candidate) => candidate.score > 0)
        .slice(0, 8)
        .map(async (candidate) => ({
        candidate,
        resolvedScore: await scoreResolvedPage(frameworkName, candidate)
    })));
    const best = rescored
        .filter((candidate) => candidate.resolvedScore > 0)
        .sort((a, b) => b.resolvedScore - a.resolvedScore ||
        b.candidate.hits - a.candidate.hits ||
        a.candidate.url.localeCompare(b.candidate.url))[0];
    if (!best) {
        const directCandidates = await Promise.all(directProbeUrls(frameworkName).map(async (url) => ({
            url,
            score: await scoreDirectProbe(frameworkName, url)
        })));
        const directBest = directCandidates
            .filter((candidate) => candidate.score > 0)
            .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))[0];
        if (!directBest) {
            throw new Error(`Unable to discover official docs for "${frameworkName}"`);
        }
        return directBest.url;
    }
    return best.candidate.url;
}
export function searchQueriesForTesting(frameworkName) {
    return unique(searchQueries(frameworkName));
}
export function directProbeUrlsForTesting(frameworkName) {
    return directProbeUrls(frameworkName);
}
// Authoritative changelog URLs. Single source of truth — diffDocs and scanDeprecations
// derive their URLs from here, not their own maps.
const knownChangelogUrls = {
    go: "https://go.dev/doc/devel/release",
    rust: "https://doc.rust-lang.org/releases.html",
    python: "https://docs.python.org/3/whatsnew/",
    ruby: "https://www.ruby-lang.org/en/news/",
    php: "https://www.php.net/ChangeLog-8.php",
    java: "https://www.oracle.com/java/technologies/javase/jdk-relnotes-index.html",
    kotlin: "https://kotlinlang.org/docs/releases.html",
    react: "https://react.dev/blog",
    nextjs: "https://nextjs.org/blog",
    vue: "https://blog.vuejs.org",
    svelte: "https://svelte.dev/blog",
    angular: "https://github.com/angular/angular/blob/main/CHANGELOG.md",
    django: "https://docs.djangoproject.com/en/stable/releases/",
    flask: "https://flask.palletsprojects.com/en/stable/changes/",
    fastapi: "https://fastapi.tiangolo.com/release-notes/",
    express: "https://expressjs.com/en/changelog/4x.html",
    postgres: "https://www.postgresql.org/docs/release/",
    mysql: "https://dev.mysql.com/doc/relnotes/mysql/8.0/en/",
    redis: "https://raw.githubusercontent.com/redis/redis/unstable/CHANGELOG.md",
    mongodb: "https://www.mongodb.com/docs/manual/release-notes/",
    terraform: "https://developer.hashicorp.com/terraform/docs/changelog",
    graphql: "https://github.com/graphql/graphql-spec/blob/main/CHANGELOG.md",
    kubernetes: "https://kubernetes.io/docs/setup/release/",
};
// Authoritative deprecation/migration pages. Same principle — single source of truth.
const knownDeprecationUrls = {
    go: "https://tip.golang.org/doc/go1compat",
    rust: "https://doc.rust-lang.org/edition-guide/editions/",
    python: "https://docs.python.org/3/whatsnew/",
    ruby: "https://www.ruby-lang.org/en/news/",
    php: "https://www.php.net/manual/en/migration82.deprecated.php",
    react: "https://react.dev/blog/2024/04/25/react-19-upgrade-guide",
    nextjs: "https://nextjs.org/docs/app/building-your-application/upgrading",
    vue: "https://v3-migration.vuejs.org/",
    svelte: "https://svelte.dev/docs/v5-migration-guide",
    angular: "https://angular.dev/update-guide",
    django: "https://docs.djangoproject.com/en/stable/internals/deprecation/",
    flask: "https://flask.palletsprojects.com/en/stable/changes/",
    fastapi: "https://fastapi.tiangolo.com/release-notes/",
    express: "https://expressjs.com/en/guide/migrating-5.html",
    kubernetes: "https://kubernetes.io/docs/reference/using-api/deprecation-guide/",
    terraform: "https://developer.hashicorp.com/terraform/language/v1-compatibility-promises",
};
/**
 * Returns the best known changelog URL for a stack.
 * Falls back to the official docs base URL if no changelog is registered.
 */
export async function discoverChangelogUrl(stack) {
    const known = knownChangelogUrls[stack.toLowerCase()];
    if (known)
        return known;
    return discoverFrameworkDocs(stack);
}
/**
 * Returns the best known deprecation/migration URL for a stack.
 * Falls back to changelog URL, then official docs.
 */
export async function discoverDeprecationUrl(stack) {
    const known = knownDeprecationUrls[stack.toLowerCase()];
    if (known)
        return known;
    const changelog = knownChangelogUrls[stack.toLowerCase()];
    if (changelog)
        return changelog;
    return discoverFrameworkDocs(stack);
}
