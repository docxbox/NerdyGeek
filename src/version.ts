import { getAllDependencies } from "./utils.js";
import type { PackageJson } from "./types.js";

const explicitVersionPattern = /\bv?(\d+(?:\.\d+){0,2})\b/;

function normalizeVersion(value: string): string {
  const clean = value.replace(/^[~^<>=\s]+/, "").trim();
  const match = clean.match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
  return match?.[1] ?? (clean || "latest");
}

export function resolveVersion(stack: string, query: string, packageJson?: PackageJson): string {
  const fromQuery = query.match(explicitVersionPattern)?.[1];

  if (fromQuery) {
    return normalizeVersion(fromQuery);
  }

  const dependencies = getAllDependencies(packageJson);
  const directMatch = dependencies[stack];

  if (directMatch) {
    return normalizeVersion(directMatch);
  }

  const aliasMap: Record<string, string[]> = {
    nextjs: ["next"],
    react: ["react"],
    django: ["django"],
    express: ["express"]
  };

  for (const alias of aliasMap[stack] ?? []) {
    const version = dependencies[alias];
    if (version) {
      return normalizeVersion(version);
    }
  }

  return "latest";
}
