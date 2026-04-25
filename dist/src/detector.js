import { getAllDependencies, normalizeText, sanitizeFrameworkName, unique } from "./utils.js";
const knownRules = [
    {
        stack: "nextjs",
        keywords: ["next", "server actions", "app router"],
        dependencies: ["next"]
    },
    {
        stack: "react",
        keywords: ["react", "hooks", "jsx"],
        dependencies: ["react", "react-dom"]
    },
    {
        stack: "django",
        keywords: ["django", "drf"],
        dependencies: ["django", "djangorestframework"]
    },
    {
        stack: "express",
        keywords: ["express", "node", "api"],
        dependencies: ["express"]
    },
    {
        stack: "go",
        keywords: ["golang", "goroutine", "go modules", "go test", "go mod", "go build"],
        dependencies: []
    }
];
function genericQueryCandidates(query) {
    const normalized = query.toLowerCase();
    const inlineCode = [...query.matchAll(/`([^`]+)`/g)].map((match) => sanitizeFrameworkName(match[1] ?? ""));
    const packageLikeTokens = normalized.match(/[@a-z0-9][@a-z0-9/_-]{1,40}/g) ?? [];
    const stopWords = new Set([
        "how",
        "what",
        "when",
        "where",
        "why",
        "the",
        "and",
        "for",
        "with",
        "from",
        "into",
        "using",
        "use",
        "docs",
        "documentation",
        "official",
        "reference",
        "guide",
        "error",
        "build",
        "api",
        "version",
        "latest",
        "code",
        "node",
        "typescript",
        "javascript"
    ]);
    return unique([...inlineCode, ...packageLikeTokens]
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !stopWords.has(token)));
}
export function detectStack(query, packageJson) {
    const normalizedQuery = normalizeText(query.toLowerCase());
    const dependencyMap = getAllDependencies(packageJson);
    const dependencyNames = Object.keys(dependencyMap).map((name) => name.toLowerCase());
    const scored = new Map();
    for (const rule of knownRules) {
        let score = 0;
        for (const keyword of rule.keywords) {
            if (normalizedQuery.includes(keyword)) {
                score += 3;
            }
        }
        for (const dep of rule.dependencies) {
            if (dependencyNames.includes(dep)) {
                score += 6;
            }
        }
        if (score > 0) {
            scored.set(rule.stack, score);
        }
    }
    for (const dependency of dependencyNames) {
        scored.set(dependency, Math.max(scored.get(dependency) ?? 0, 5));
    }
    for (const candidate of genericQueryCandidates(query)) {
        scored.set(candidate, Math.max(scored.get(candidate) ?? 0, 2));
    }
    const sorted = [...scored.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([stack]) => stack);
    return sorted.length > 0 ? sorted : ["unknown"];
}
