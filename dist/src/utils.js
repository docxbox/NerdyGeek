import crypto from "node:crypto";
export function normalizeText(value) {
    return value.trim().replace(/\s+/g, " ");
}
export function unique(values) {
    return [...new Set(values)];
}
export function cacheKey(stack, version, query) {
    return crypto
        .createHash("sha256")
        .update(`${stack}:${version}:${query}`)
        .digest("hex")
        .slice(0, 24);
}
export function getAllDependencies(packageJson) {
    return {
        ...(packageJson?.dependencies ?? {}),
        ...(packageJson?.devDependencies ?? {}),
        ...(packageJson?.peerDependencies ?? {}),
        ...(packageJson?.optionalDependencies ?? {})
    };
}
export function toAbsoluteUrl(baseUrl, candidate) {
    try {
        return new URL(candidate, baseUrl).toString();
    }
    catch {
        return null;
    }
}
export function safeHostname(value) {
    try {
        return new URL(value).hostname.toLowerCase();
    }
    catch {
        return "";
    }
}
export function sanitizeFrameworkName(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9@/_-]+/g, " ")
        .trim();
}
