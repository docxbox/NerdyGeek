import { cacheKey, normalizeText } from "./utils.js";
function slugify(value) {
    return normalizeText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}
export function createDocHandle(input) {
    const prefix = slugify(`${input.tool}-${input.stack}-${input.version}`) || input.tool;
    const suffix = cacheKey(input.stack, input.version, `${input.tool}:${input.seed}`).slice(0, 8);
    return `${prefix}-${suffix}`;
}
