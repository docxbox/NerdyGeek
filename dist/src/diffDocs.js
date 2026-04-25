import * as cheerio from "cheerio";
import { fetchWithTimeout } from "./http.js";
import { discoverChangelogUrl } from "./discovery.js";
import { retrieveDocs } from "./retriever.js";
import { rankChunks } from "./ranker.js";
import { normalizeText, unique } from "./utils.js";
const deprecationSignals = [
    /deprecat/i,
    /no\s+longer\s+supported/i,
    /migration\s+guide/i,
    /upgrade\s+guide/i,
];
const newFeatureSignals = [/added/i, /introduced/i, /new\s+in/i, /feat(?:ure)?:/i, /support\s+for/i];
const removedSignals = [/removed/i, /deleted/i, /dropped/i];
const breakingSignals = [/breaking/i, /incompatible/i, /must\s+now/i, /no\s+longer/i];
export function classifyChunk(text) {
    if (removedSignals.some((r) => r.test(text)))
        return "removed";
    if (deprecationSignals.some((r) => r.test(text)))
        return "deprecated";
    if (breakingSignals.some((r) => r.test(text)))
        return "breaking";
    if (newFeatureSignals.some((r) => r.test(text)))
        return "new";
    return null;
}
function scoreDiffDocument(document, stack, fromVersion, toVersion) {
    const url = document.url.toLowerCase();
    const text = normalizeText(document.html.replace(/<[^>]+>/g, " ")).toLowerCase().slice(0, 12000);
    const combined = `${url} ${text}`;
    let score = 0;
    if (/(upgrade|migration)/.test(url)) {
        score += 12;
    }
    if (/(changelog|release|releases|blog)/.test(url)) {
        score += 4;
    }
    if (combined.includes(`${stack.toLowerCase()} ${toVersion.toLowerCase()}`)) {
        score += 10;
    }
    if (combined.includes(`${stack.toLowerCase()} ${fromVersion.toLowerCase()}`)) {
        score += 4;
    }
    if (combined.includes(`v${toVersion.toLowerCase()}`) || combined.includes(`version ${toVersion.toLowerCase()}`)) {
        score += 8;
    }
    if (combined.includes(`v${fromVersion.toLowerCase()}`) || combined.includes(`version ${fromVersion.toLowerCase()}`)) {
        score += 3;
    }
    if (/(breaking|deprecated|removed|upgrade guide|migration guide)/.test(combined)) {
        score += 6;
    }
    if (/read more|you can also follow|posted here first/.test(combined)) {
        score -= 8;
    }
    return score;
}
export function chooseBestDiffDocument(documents, stack, fromVersion, toVersion) {
    return documents
        .map((document) => ({
        document,
        score: scoreDiffDocument(document, stack, fromVersion, toVersion)
    }))
        .sort((a, b) => b.score - a.score || a.document.url.localeCompare(b.document.url))[0]?.document;
}
function extractVersionSection(html, fromVersion, toVersion) {
    const $ = cheerio.load(html);
    const text = normalizeText($("main, article, body").first().text());
    // Try to find the section between the two versions in the changelog text.
    const vFrom = fromVersion.replace(/\./g, "\\.");
    const vTo = toVersion.replace(/\./g, "\\.");
    const sectionPattern = new RegExp(`${vTo}[\\s\\S]{0,8000}?(?=${vFrom}|$)`, "i");
    const match = text.match(sectionPattern);
    return match?.[0] ?? text.slice(0, 6000);
}
async function fetchChangelogUrl(stack) {
    return discoverChangelogUrl(stack);
}
export async function diff_docs(input) {
    const { stack, fromVersion, toVersion } = input;
    const changelogUrl = await fetchChangelogUrl(stack);
    const query = `${stack} ${fromVersion} to ${toVersion} upgrade guide migration breaking changes deprecated removed`;
    let bestSourceUrl = changelogUrl;
    let sectionText = "";
    try {
        const response = await fetchWithTimeout(changelogUrl);
        if (response.ok) {
            const html = await response.text();
            sectionText = extractVersionSection(html, fromVersion, toVersion);
        }
    }
    catch {
        // Fall through to ranked-chunk approach
    }
    const docs = await retrieveDocs([changelogUrl], query);
    const bestDocument = chooseBestDiffDocument(docs, stack, fromVersion, toVersion);
    if (bestDocument) {
        bestSourceUrl = bestDocument.url;
        try {
            const focusedSection = extractVersionSection(bestDocument.html, fromVersion, toVersion);
            if (focusedSection.length > sectionText.length || /(upgrade|migration|breaking|deprecated|removed)/i.test(focusedSection)) {
                sectionText = focusedSection;
            }
        }
        catch {
            // Keep current section text
        }
    }
    if (!sectionText) {
        const chunks = rankChunks(docs, query);
        sectionText = chunks
            .slice(0, 8)
            .map((c) => c.text)
            .join(" ");
    }
    const sentences = sectionText
        .split(/(?<=[.!?])\s+|\n+/)
        .map(normalizeText)
        .filter((s) => s.length > 20);
    const changes = [];
    for (const sentence of sentences.slice(0, 40)) {
        const type = classifyChunk(sentence);
        if (type) {
            // Avoid duplicates
            if (!changes.some((c) => c.description === sentence)) {
                changes.push({ type, description: sentence });
            }
        }
    }
    // If we found nothing meaningful, add a generic entry with the raw summary.
    if (changes.length === 0 && sectionText.length > 0) {
        changes.push({
            type: "breaking",
            description: `See official migration guide: ${bestSourceUrl}`
        });
    }
    return {
        stack,
        fromVersion,
        toVersion,
        changes,
        sources: unique([bestSourceUrl, changelogUrl])
    };
}
