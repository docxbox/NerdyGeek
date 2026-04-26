import { createDocHandle } from "./handles.js";
import type {
  CacheStatus,
  DeprecationMatch,
  DiffEntry,
  DiffResponse,
  DocsMode,
  RankedChunk,
  ScanResponse,
  SearchDocsResponse
} from "./types.js";
import { normalizeText, unique } from "./utils.js";

const maxListByMode: Record<DocsMode, number> = {
  quick: 1,
  full: 3,
  deep: 5
};

function nowIso(): string {
  return new Date().toISOString();
}

function compactList(items: string[], mode: DocsMode): string[] {
  return unique(items.map((item) => normalizeText(item)).filter((item) => item.length >= 8)).slice(0, maxListByMode[mode]);
}

function collectGotchasFromChunks(chunks: RankedChunk[], mode: DocsMode): string[] {
  return compactList(
    chunks
      .map((chunk) => chunk.text)
      .filter((text) => /\b(deprecated|warning|requires|must|only|cannot|avoid|breaking)\b/i.test(text)),
    mode
  );
}

function collectActionsFromChunks(chunks: RankedChunk[], mode: DocsMode): string[] {
  return compactList(
    chunks
      .map((chunk) => chunk.text)
      .filter((text) => /\b(use|call|set|pass|import|configure|migrate|replace)\b/i.test(text)),
    mode
  );
}

function summarizeChunkTexts(chunks: RankedChunk[], mode: DocsMode): string {
  const summary = compactList(chunks.map((chunk) => chunk.text), mode).join(" ");
  return normalizeText(summary);
}

export function formatSearchDocsEnvelope(input: {
  stack: string;
  version: string;
  mode: DocsMode;
  chunks: RankedChunk[];
  sources: string[];
  confidence: number;
  code?: string;
  cacheStatus?: CacheStatus;
  query: string;
}): SearchDocsResponse {
  const summary = summarizeChunkTexts(input.chunks, input.mode);
  return {
    tool: "search_docs",
    stack: input.stack,
    version: input.version,
    mode: input.mode,
    summary,
    answer: summary,
    actions: collectActionsFromChunks(input.chunks, input.mode),
    gotchas: collectGotchasFromChunks(input.chunks, input.mode),
    ...(input.code ? { code: input.code } : {}),
    sources: input.sources,
    confidence: input.confidence,
    docHandle: createDocHandle({
      tool: "search_docs",
      stack: input.stack,
      version: input.version,
      seed: input.query
    }),
    cacheStatus: input.cacheStatus ?? "miss",
    retrievedAt: nowIso()
  };
}

function groupChangeEntries(changes: DiffEntry[], type: DiffEntry["type"], mode: DocsMode): string[] {
  return compactList(
    changes
      .filter((change) => change.type === type)
      .map((change) =>
        change.replacement
          ? `${change.description} Replace with ${change.replacement}.`
          : change.description
      ),
    mode
  );
}

export function formatDiffDocsEnvelope(input: {
  stack: string;
  fromVersion: string;
  toVersion: string;
  changes: DiffEntry[];
  sources: string[];
  mode?: DocsMode;
  cacheStatus?: CacheStatus;
}): DiffResponse {
  const mode = input.mode ?? "full";
  const actions = compactList(
    input.changes
      .filter((change) => change.replacement || change.type === "breaking")
      .map((change) =>
        change.replacement
          ? `${change.description} Replace with ${change.replacement}.`
          : change.description
      ),
    mode
  );
  const gotchas = compactList(
    input.changes
      .filter((change) => change.type === "removed" || change.type === "breaking")
      .map((change) => change.description),
    mode
  );
  const summary =
    `${input.stack} ${input.fromVersion} -> ${input.toVersion}: ` +
    `${input.changes.length} relevant changes found (` +
    `${input.changes.filter((change) => change.type === "new").length} new, ` +
    `${input.changes.filter((change) => change.type === "deprecated").length} deprecated, ` +
    `${input.changes.filter((change) => change.type === "removed").length} removed, ` +
    `${input.changes.filter((change) => change.type === "breaking").length} breaking).`;

  const orderedChanges = [
    ...groupChangeEntries(input.changes, "breaking", mode).map((description) => ({ type: "breaking" as const, description })),
    ...groupChangeEntries(input.changes, "removed", mode).map((description) => ({ type: "removed" as const, description })),
    ...groupChangeEntries(input.changes, "deprecated", mode).map((description) => ({ type: "deprecated" as const, description })),
    ...groupChangeEntries(input.changes, "new", mode).map((description) => ({ type: "new" as const, description }))
  ];

  return {
    tool: "diff_docs",
    stack: input.stack,
    version: `${input.fromVersion}->${input.toVersion}`,
    mode,
    summary,
    actions,
    gotchas,
    sources: input.sources,
    confidence: input.changes.length > 0 ? 0.84 : 0.68,
    docHandle: createDocHandle({
      tool: "diff_docs",
      stack: input.stack,
      version: `${input.fromVersion}-${input.toVersion}`,
      seed: `${input.fromVersion}:${input.toVersion}:${input.sources[0] ?? input.stack}`
    }),
    cacheStatus: input.cacheStatus ?? "miss",
    retrievedAt: nowIso(),
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    changes: orderedChanges
  };
}

function formatDeprecationAction(match: DeprecationMatch): string {
  if (match.replacement) {
    return `${match.api} on line ${match.line}: use ${match.replacement} instead.`;
  }
  return `${match.api} on line ${match.line}: ${match.reason}`;
}

export function formatScanEnvelope(input: {
  stack: string;
  version: string;
  deprecated: DeprecationMatch[];
  removed: DeprecationMatch[];
  sources: string[];
  mode?: DocsMode;
  cacheStatus?: CacheStatus;
}): ScanResponse {
  const mode = input.mode ?? "full";
  const summary =
    input.deprecated.length === 0 && input.removed.length === 0
      ? `${input.stack} ${input.version}: no deprecated or removed APIs were detected in the scanned file.`
      : `${input.stack} ${input.version}: found ${input.deprecated.length} deprecated and ${input.removed.length} removed API usages.`;

  return {
    tool: "scan_deprecations",
    stack: input.stack,
    version: input.version,
    mode,
    summary,
    actions: compactList(
      [...input.removed, ...input.deprecated].map(formatDeprecationAction),
      mode
    ),
    gotchas: compactList(
      [...input.removed, ...input.deprecated].map((match) => match.reason),
      mode
    ),
    sources: input.sources,
    confidence: input.sources.length > 0 ? 0.82 : 0.72,
    docHandle: createDocHandle({
      tool: "scan_deprecations",
      stack: input.stack,
      version: input.version,
      seed: `${input.sources[0] ?? input.stack}:${input.deprecated.length}:${input.removed.length}`
    }),
    cacheStatus: input.cacheStatus ?? "miss",
    retrievedAt: nowIso(),
    deprecated: input.deprecated,
    removed: input.removed
  };
}
