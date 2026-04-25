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
    if (!sectionText) {
        const query = `${stack} ${fromVersion} to ${toVersion} migration breaking changes`;
        const docs = await retrieveDocs([changelogUrl], query);
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
            description: `See official migration guide: ${changelogUrl}`
        });
    }
    return {
        stack,
        fromVersion,
        toVersion,
        changes,
        sources: unique([changelogUrl])
    };
}
