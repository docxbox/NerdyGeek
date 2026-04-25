import * as cheerio from "cheerio";
import { fetchWithTimeout } from "./http.js";
import { normalizeText, safeHostname, sanitizeFrameworkName, unique } from "./utils.js";
const discouragedHostsPattern = /(medium\.com|dev\.to|stackoverflow\.com|reddit\.com|wikipedia\.org)/i;
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
export async function discoverFrameworkDocs(frameworkName) {
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
