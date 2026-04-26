import { cacheKey, normalizeText } from "./utils.js";
import type { NerdyGeekTool } from "./types.js";

function slugify(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function createDocHandle(input: {
  tool: NerdyGeekTool;
  stack: string;
  version: string;
  seed: string;
}): string {
  const prefix = slugify(`${input.tool}-${input.stack}-${input.version}`) || input.tool;
  const suffix = cacheKey(input.stack, input.version, `${input.tool}:${input.seed}`).slice(0, 8);
  return `${prefix}-${suffix}`;
}
