import { z } from "zod";

export type DocsMode = "quick" | "full" | "deep";
export type NerdyGeekTool = "search_docs" | "diff_docs" | "scan_deprecations";
export type CacheStatus = "hit" | "miss";

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

export type NerdyGeekEnvelope = {
  tool: NerdyGeekTool;
  stack: string;
  version: string;
  mode: DocsMode;
  summary: string;
  actions: string[];
  gotchas: string[];
  code?: string;
  sources: string[];
  confidence: number;
  docHandle: string;
  cacheStatus: CacheStatus;
  retrievedAt: string;
};

export type SearchDocsResponse = NerdyGeekEnvelope & {
  tool: "search_docs";
  answer: string;
};

export type DiffEntry = {
  type: "new" | "deprecated" | "removed" | "breaking";
  description: string;
  replacement?: string;
};

export type DiffResponse = NerdyGeekEnvelope & {
  tool: "diff_docs";
  fromVersion: string;
  toVersion: string;
  changes: DiffEntry[];
};

export type DeprecationMatch = {
  line: number;
  api: string;
  reason: string;
  replacement?: string;
};

export type ScanResponse = NerdyGeekEnvelope & {
  tool: "scan_deprecations";
  deprecated: DeprecationMatch[];
  removed: DeprecationMatch[];
};

export type NerdyGeekResponse = SearchDocsResponse | DiffResponse | ScanResponse;

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
export const cacheStatusSchema = z.enum(["hit", "miss"]);

export const nerdyGeekEnvelopeSchema = z.object({
  tool: z.enum(["search_docs", "diff_docs", "scan_deprecations"]),
  stack: z.string().min(1),
  version: z.string().min(1),
  mode: docsModeSchema,
  summary: z.string().min(20),
  actions: z.array(z.string().min(1)).max(5),
  gotchas: z.array(z.string().min(1)).max(5),
  code: z.string().min(1).optional(),
  sources: z.array(z.string().url()).min(1),
  confidence: z.number().min(0).max(1),
  docHandle: z.string().min(3),
  cacheStatus: cacheStatusSchema,
  retrievedAt: z.string().min(10)
});

export const searchDocsRequestSchema = z.object({
  query: z.string().min(3),
  mode: docsModeSchema.optional(),
  packageJson: packageJsonSchema.optional(),
  lockfiles: lockfileContextSchema.optional()
});

export const searchDocsResponseSchema = nerdyGeekEnvelopeSchema.extend({
  tool: z.literal("search_docs"),
  answer: z.string().min(20)
});

export const diffEntrySchema = z.object({
  type: z.enum(["new", "deprecated", "removed", "breaking"]),
  description: z.string().min(5),
  replacement: z.string().min(1).optional()
});

export const diffResponseSchema = nerdyGeekEnvelopeSchema.extend({
  tool: z.literal("diff_docs"),
  fromVersion: z.string().min(1),
  toVersion: z.string().min(1),
  changes: z.array(diffEntrySchema)
});

export const deprecationMatchSchema = z.object({
  line: z.number().int().positive(),
  api: z.string().min(1),
  reason: z.string().min(5),
  replacement: z.string().min(1).optional()
});

export const scanResponseSchema = nerdyGeekEnvelopeSchema.extend({
  tool: z.literal("scan_deprecations"),
  deprecated: z.array(deprecationMatchSchema),
  removed: z.array(deprecationMatchSchema)
});
