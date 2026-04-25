import { z } from "zod";

export type DocsMode = "quick" | "full" | "deep";

export type PackageJson = {
  name?: string | undefined;
  dependencies?: Record<string, string> | undefined;
  devDependencies?: Record<string, string> | undefined;
  peerDependencies?: Record<string, string> | undefined;
  optionalDependencies?: Record<string, string> | undefined;
};

export type LockfileContext = {
  packageJson?: PackageJson;
  goMod?: string;
  cargoToml?: string;
  requirementsTxt?: string;
  gemfileLock?: string;
};

export type SourceType = "official" | "api" | "example" | "blog";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  score: number;
};

export type RetrievedDocument = {
  url: string;
  sourceType: SourceType;
  html: string;
};

export type RankedChunk = {
  text: string;
  url: string;
  sourceType: SourceType;
  score: number;
};

export type DocsResponse = {
  stack: string;
  version: string;
  answer: string;
  code?: string;
  sources: string[];
  confidence: number;
};

export type DiffEntry = {
  type: "new" | "deprecated" | "removed" | "breaking";
  description: string;
  replacement?: string;
};

export type DiffResponse = {
  stack: string;
  fromVersion: string;
  toVersion: string;
  changes: DiffEntry[];
  sources: string[];
};

export type DeprecationMatch = {
  line: number;
  api: string;
  reason: string;
  replacement?: string;
};

export type ScanResponse = {
  stack: string;
  version: string;
  deprecated: DeprecationMatch[];
  removed: DeprecationMatch[];
  sources: string[];
};

export const packageJsonSchema = z
  .object({
    name: z.string().optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional()
  })
  .passthrough();

export const lockfileContextSchema = z.object({
  packageJson: packageJsonSchema.optional(),
  goMod: z.string().optional(),
  cargoToml: z.string().optional(),
  requirementsTxt: z.string().optional(),
  gemfileLock: z.string().optional()
});

export const docsModeSchema = z.enum(["quick", "full", "deep"]).default("full");

export const searchDocsRequestSchema = z.object({
  query: z.string().min(3),
  mode: docsModeSchema.optional(),
  packageJson: packageJsonSchema.optional(),
  lockfiles: lockfileContextSchema.optional()
});

export const docsResponseSchema = z.object({
  stack: z.string().min(1),
  version: z.string().min(1),
  answer: z.string().min(1),
  code: z.string().min(1).optional(),
  sources: z.array(z.string().url()).min(1),
  confidence: z.number().min(0).max(1)
});
