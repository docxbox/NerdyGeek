import { discoverDeprecationUrl } from "./discovery.js";
import { retrieveDocs } from "./retriever.js";
import { rankChunks } from "./ranker.js";
import { extract } from "./extractor.js";
import { fetchWithTimeout } from "./http.js";
import { normalizeText, unique } from "./utils.js";
export function extractApiCalls(fileContent) {
    const lines = fileContent.split("\n");
    const results = [];
    const seen = new Set();
    const patterns = [
        // import { X } from "pkg"
        /import\s*\{([^}]+)\}/g,
        // require("pkg").X or require("pkg")
        /require\s*\(['"]([\w/@-]+)['"]\)/g,
        // obj.method() calls
        /\b([\w]+\.[\w]+)\s*\(/g,
        // function calls
        /\b([A-Z][\w]+)\s*\(/g,
    ];
    lines.forEach((line, idx) => {
        for (const pattern of patterns) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;
            while ((match = regex.exec(line)) !== null) {
                const raw = match[1] ?? "";
                // Handle destructured imports: "useState, useEffect, useRef"
                const tokens = raw.includes(",") ? raw.split(",").map((t) => t.trim()) : [raw.trim()];
                for (const token of tokens) {
                    const clean = token.replace(/\s+as\s+\w+/, "").trim();
                    if (clean.length > 1 && !seen.has(clean)) {
                        seen.add(clean);
                        results.push({ name: clean, line: idx + 1 });
                    }
                }
            }
        }
    });
    return results;
}
export function matchDeprecation(apiName, deprecationText) {
    const lower = deprecationText.toLowerCase();
    const apiLower = apiName.toLowerCase();
    if (!lower.includes(apiLower))
        return null;
    // Find the sentence that mentions this API and contains deprecation signal.
    const sentences = deprecationText
        .split(/(?<=[.!?])\s+|\n+/)
        .map(normalizeText)
        .filter((s) => s.toLowerCase().includes(apiLower));
    for (const sentence of sentences) {
        if (/deprecat|removed|no longer|replaced/i.test(sentence)) {
            // Try to extract replacement suggestion.
            const replacementMatch = sentence.match(/use\s+([\w.]+)|replaced?\s+(?:by|with)\s+([\w.]+)/i);
            const replacement = replacementMatch?.[1] ?? replacementMatch?.[2];
            return replacement
                ? { reason: sentence.slice(0, 200), replacement }
                : { reason: sentence.slice(0, 200) };
        }
    }
    return null;
}
async function fetchDeprecationText(stack) {
    const url = await discoverDeprecationUrl(stack);
    try {
        const response = await fetchWithTimeout(url);
        if (response.ok) {
            const html = await response.text();
            const chunks = extract(html);
            return { text: chunks.join(" ").slice(0, 20000), url };
        }
    }
    catch {
        // Fall through to retriever
    }
    const query = `${stack} deprecated api removed migration`;
    const docs = await retrieveDocs([url], query);
    const chunks = rankChunks(docs, query);
    return {
        text: chunks.map((c) => c.text).join(" ").slice(0, 20000),
        url
    };
}
export async function scan_deprecations(input) {
    const { fileContent, stack, version = "latest" } = input;
    const apiCalls = extractApiCalls(fileContent);
    if (apiCalls.length === 0) {
        return { stack, version, deprecated: [], removed: [], sources: [] };
    }
    const { text: deprecationText, url: sourceUrl } = await fetchDeprecationText(stack);
    const deprecated = [];
    const removed = [];
    for (const { name, line } of apiCalls) {
        const match = matchDeprecation(name, deprecationText);
        if (!match)
            continue;
        const isRemoved = /removed|deleted|dropped/i.test(match.reason);
        const entry = match.replacement
            ? { line, api: name, reason: match.reason, replacement: match.replacement }
            : { line, api: name, reason: match.reason };
        if (isRemoved) {
            removed.push(entry);
        }
        else {
            deprecated.push(entry);
        }
    }
    return {
        stack,
        version,
        deprecated,
        removed,
        sources: unique([sourceUrl])
    };
}
