import crypto from "node:crypto";
import type { PackageJson } from "./types.js";

const discouragedHostsPattern =
  /(medium\.com|dev\.to|stackoverflow\.com|reddit\.com|wikipedia\.org|substack\.com|hashnode\.dev)/i;
const discouragedMirrorPattern =
  /\b(mirror|mirrors|translated|translation|community|community-maintained|unofficial|archive|fork)\b/i;

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function cacheKey(stack: string, version: string, query: string): string {
  return crypto
    .createHash("sha256")
    .update(`${stack}:${version}:${query}`)
    .digest("hex")
    .slice(0, 24);
}

export function getAllDependencies(packageJson?: PackageJson): Record<string, string> {
  return {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
    ...(packageJson?.peerDependencies ?? {}),
    ...(packageJson?.optionalDependencies ?? {})
  };
}

export function toAbsoluteUrl(baseUrl: string, candidate: string): string | null {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return null;
  }
}

export function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function sanitizeFrameworkName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@/_-]+/g, " ")
    .trim();
}

export function isLikelyOfficialSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const labels = hostname.split(".").filter(Boolean);
    const rootLikeHost = labels.length <= 3 && !/^(blog|news|community|forum|forums|discuss|archive)\./.test(hostname);
    const docsLikePath =
      /^\/($|docs?(\/|$)|reference(\/|$)|guide(\/|$)|api(\/|$)|learn(\/|$)|pkg(\/|$)|doc(\/|$)|manual(\/|$)|spec(\/|$)|blog(\/|$))/.test(
        path
      );
    const docsLikeHost = /^(docs|developer|api|pkg|www)\./.test(hostname);

    if (!/^https?:$/.test(url.protocol)) {
      return false;
    }

    if (discouragedHostsPattern.test(hostname) || discouragedMirrorPattern.test(`${hostname} ${value}`)) {
      return false;
    }

    return docsLikeHost || docsLikePath || rootLikeHost;
  } catch {
    return false;
  }
}
