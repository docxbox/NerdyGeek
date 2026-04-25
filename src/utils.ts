import crypto from "node:crypto";
import type { PackageJson } from "./types.js";

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
