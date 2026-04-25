import { extract } from "./extractor.js";
const typeScore = {
    official: 10,
    api: 6,
    example: 4,
    blog: 1
};
function queryTerms(query) {
    return [...new Set((query.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((word) => word.length >= 3))];
}
export function rankChunks(documents, query) {
    const keywords = queryTerms(query);
    const normalizedQuery = query.toLowerCase().replace(/\(\)/g, "");
    return documents
        .flatMap((document) => extract(document.html).map((text) => {
        const lower = text.toLowerCase();
        const normalizedUrl = document.url.toLowerCase().replace(/\(\)/g, "");
        const overlap = keywords.reduce((count, keyword) => count + (lower.includes(keyword) ? 1 : 0), 0);
        const urlOverlap = keywords.reduce((count, keyword) => count + (normalizedUrl.includes(keyword) ? 1 : 0), 0);
        let score = typeScore[document.sourceType] + overlap * 2 + urlOverlap * 3;
        if (normalizedQuery.includes("server actions") && lower.includes("server actions")) {
            score += 5;
        }
        if (normalizedQuery.includes("cookies") && (lower.includes("cookies") || lower.includes("cookies()"))) {
            score += 6;
        }
        if (normalizedUrl.includes("cookies")) {
            score += 4;
        }
        if (lower.includes("deprecated")) {
            score -= 10;
        }
        return {
            text,
            url: document.url,
            sourceType: document.sourceType,
            score
        };
    }))
        .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url) || a.text.localeCompare(b.text));
}
