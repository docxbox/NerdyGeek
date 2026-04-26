import { semanticCache } from "./cache.js";
import { detectStack } from "./detector.js";
import { discoverFrameworkDocs } from "./discovery.js";
import { extractRelevantCodeBlocks } from "./extractor.js";
import { formatSearchDocsEnvelope } from "./formatter.js";
import { rankChunks } from "./ranker.js";
import { retrieveDocs } from "./retriever.js";
import { withRetry } from "./retry.js";
import { cacheKey, unique } from "./utils.js";
import { resolveVersion } from "./version.js";
const modeConfig = {
    quick: { maxCodeBlocks: 1, maxSources: 1 },
    full: { maxCodeBlocks: 1, maxSources: 3 },
    deep: { maxCodeBlocks: 3, maxSources: 5 }
};
function queryTerms(query) {
    return [...new Set((query.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((word) => word.length >= 3))];
}
function scoreCodeBlock(code, query, url) {
    const normalizedCode = code.toLowerCase();
    const normalizedUrl = url.toLowerCase();
    const terms = queryTerms(query);
    let score = terms.reduce((count, term) => count + (normalizedCode.includes(term) ? 1 : 0), 0) * 2;
    if (query.toLowerCase().includes("cookies") && normalizedCode.includes("cookies")) {
        score += 6;
    }
    if (query.toLowerCase().includes("server actions") && normalizedCode.includes("'use server'")) {
        score += 5;
    }
    if (normalizedUrl.includes("cookies")) {
        score += 3;
    }
    if (normalizedCode.includes("allowedorigins")) {
        score -= 6;
    }
    return score;
}
function chooseBestCodes(documents, rankedChunks, query, maxBlocks) {
    const rankedUrls = unique(rankedChunks.map((chunk) => chunk.url));
    const orderedDocuments = [
        ...rankedUrls
            .map((url) => documents.find((document) => document.url === url))
            .filter((document) => Boolean(document)),
        ...documents.filter((document) => !rankedUrls.includes(document.url))
    ];
    const candidates = orderedDocuments.flatMap((document) => extractRelevantCodeBlocks(document.html).map((code) => ({
        code,
        score: scoreCodeBlock(code, query, document.url)
    })));
    return candidates
        .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
        .slice(0, maxBlocks)
        .map((candidate) => candidate.code);
}
function computeConfidence(chunks, query) {
    const top = chunks[0];
    if (!top) {
        return 0.5;
    }
    const terms = queryTerms(query);
    const text = top.text.toLowerCase();
    const url = top.url.toLowerCase();
    const overlap = terms.reduce((count, term) => count + (text.includes(term) || url.includes(term) ? 1 : 0), 0);
    const strongMatch = overlap >= Math.max(2, Math.ceil(terms.length / 2));
    if (top.sourceType === "official") {
        return strongMatch ? 0.9 : 0.85;
    }
    if (top.sourceType === "api") {
        return strongMatch ? 0.82 : 0.78;
    }
    return 0.7;
}
export async function search_docs(input) {
    const mode = input.mode ?? "full";
    const { maxCodeBlocks, maxSources } = modeConfig[mode];
    const candidates = detectStack(input.query, input.packageJson ?? input.lockfiles?.packageJson);
    const chosenStack = candidates[0] ?? "unknown";
    const version = resolveVersion(chosenStack, input.query, input.packageJson, input.lockfiles);
    const key = cacheKey(chosenStack, version, `${mode}:${input.query}`);
    const cached = semanticCache.getCache(key);
    if (cached && cached.tool === "search_docs") {
        return {
            ...cached,
            cacheStatus: "hit"
        };
    }
    const result = await withRetry(async () => {
        const officialUrl = await discoverFrameworkDocs(chosenStack, input.query);
        const documents = await retrieveDocs([officialUrl], input.query);
        const chunks = rankChunks(documents, input.query);
        const codes = chooseBestCodes(documents, chunks, input.query, maxCodeBlocks);
        const sources = unique([officialUrl, ...chunks.slice(0, maxSources).map((chunk) => chunk.url)]).slice(0, maxSources);
        return formatSearchDocsEnvelope({
            stack: chosenStack,
            version,
            mode,
            chunks,
            sources: sources.length > 0 ? sources : [officialUrl],
            confidence: computeConfidence(chunks, input.query),
            query: input.query,
            cacheStatus: "miss",
            ...(codes.length > 0 ? { code: codes.join("\n\n---\n\n") } : {})
        });
    });
    semanticCache.setCache(key, result);
    return result;
}
