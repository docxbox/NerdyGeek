import { getAllDependencies } from "./utils.js";
import type { LockfileContext, PackageJson } from "./types.js";

const explicitVersionPattern = /\bv?(\d+(?:\.\d+){0,2})\b/;

function normalizeVersion(value: string): string {
  const clean = value.replace(/^[~^<>=\s]+/, "").trim();
  const match = clean.match(/(\d+)(?:\.\d+)?(?:\.\d+)?/);
  return match?.[1] ?? (clean || "latest");
}

function versionFromGoMod(goMod: string, module: string): string | null {
  const lines = goMod.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("go ") && module === "go") {
      const v = trimmed.replace("go ", "").trim();
      return v || null;
    }
    if (trimmed.startsWith("require") || (!trimmed.startsWith("//") && trimmed.includes(" v"))) {
      const match = trimmed.match(new RegExp(`${module.replace("/", "\\/")}\\s+v([\\d.]+)`));
      if (match?.[1]) return match[1];
    }
  }
  return null;
}

function versionFromCargoToml(cargoToml: string, crate: string): string | null {
  const pattern = new RegExp(`${crate}\\s*=\\s*["{].*?(\\d+\\.\\d+(?:\\.\\d+)?)`);
  const match = cargoToml.match(pattern);
  return match?.[1] ?? null;
}

function versionFromRequirementsTxt(requirements: string, pkg: string): string | null {
  const lines = requirements.split("\n");
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith(pkg.toLowerCase())) {
      const match = trimmed.match(/[=><~!]+\s*([\d.]+)/);
      if (match?.[1]) return match[1];
    }
  }
  return null;
}

function versionFromGemfileLock(gemfileLock: string, gem: string): string | null {
  const pattern = new RegExp(`^\\s{4}${gem}\\s+\\((\\d+\\.\\d+(?:\\.\\d+)?)\\)`);
  for (const line of gemfileLock.split("\n")) {
    const match = line.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function resolveVersion(stack: string, query: string, packageJson?: PackageJson, lockfiles?: LockfileContext): string {
  const fromQuery = query.match(explicitVersionPattern)?.[1];
  if (fromQuery) return normalizeVersion(fromQuery);

  if (lockfiles?.goMod) {
    const v = versionFromGoMod(lockfiles.goMod, stack === "go" ? "go" : stack);
    if (v) return normalizeVersion(v);
  }

  if (lockfiles?.cargoToml) {
    const v = versionFromCargoToml(lockfiles.cargoToml, stack);
    if (v) return normalizeVersion(v);
  }

  if (lockfiles?.requirementsTxt) {
    const v = versionFromRequirementsTxt(lockfiles.requirementsTxt, stack);
    if (v) return normalizeVersion(v);
  }

  if (lockfiles?.gemfileLock) {
    const v = versionFromGemfileLock(lockfiles.gemfileLock, stack);
    if (v) return normalizeVersion(v);
  }

  const allPackageJson = packageJson ?? lockfiles?.packageJson;
  const dependencies = getAllDependencies(allPackageJson);
  const directMatch = dependencies[stack];
  if (directMatch) return normalizeVersion(directMatch);

  const aliasMap: Record<string, string[]> = {
    nextjs: ["next"],
    react: ["react"],
    vue: ["vue"],
    svelte: ["svelte"],
    angular: ["@angular/core"],
    django: ["django"],
    flask: ["flask"],
    fastapi: ["fastapi"],
    express: ["express"],
    postgres: ["pg", "postgres"],
    mysql: ["mysql2", "mysql"],
    redis: ["redis", "ioredis"],
    mongodb: ["mongodb", "mongoose"],
    graphql: ["graphql"],
  };

  for (const alias of aliasMap[stack] ?? []) {
    const version = dependencies[alias];
    if (version) return normalizeVersion(version);
  }

  return "latest";
}
