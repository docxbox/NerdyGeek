import { semanticCache } from "./cache.js";
import { detectStack } from "./detector.js";
import { discoverFrameworkDocs } from "./discovery.js";
import { extractRelevantCodeBlocks } from "./extractor.js";
import { rankChunks } from "./ranker.js";
import { retrieveDocs } from "./retriever.js";
import { withRetry } from "./retry.js";
import { cacheKey, normalizeText, unique } from "./utils.js";
import { resolveVersion } from "./version.js";
function summarizeChunks(chunks, stack, version) {
    const selected = unique(chunks.slice(0, 4).map((chunk) => normalizeText(chunk.text))).slice(0, 3);
    if (selected.length === 0) {
        throw new Error(`No useful documentation content found for ${stack}`);
    }
    return [`${stack} ${version}:`, ...selected].join(" ");
}
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
function chooseBestCode(documents, rankedChunks, query) {
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
    return candidates.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))[0]?.code;
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
    const candidates = detectStack(input.query, input.packageJson);
    const chosenStack = candidates[0] ?? "unknown";
    const version = resolveVersion(chosenStack, input.query, input.packageJson);
    const key = cacheKey(chosenStack, version, input.query);
    const cached = semanticCache.getCache(key);
    if (cached) {
        return cached;
    }
    const result = await withRetry(async () => {
        const officialUrl = await discoverFrameworkDocs(chosenStack);
        const documents = await retrieveDocs([officialUrl], input.query);
        const chunks = rankChunks(documents, input.query);
        const code = chooseBestCode(documents, chunks, input.query);
        const sources = unique([officialUrl, ...chunks.slice(0, 3).map((chunk) => chunk.url)]).slice(0, 3);
        const response = {
            stack: chosenStack,
            version,
            answer: summarizeChunks(chunks, chosenStack, version),
            sources: sources.length > 0 ? sources : [officialUrl],
            confidence: computeConfidence(chunks, input.query)
        };
        if (code) {
            response.code = code;
        }
        return response;
    });
    semanticCache.setCache(key, result);
    return result;
}
