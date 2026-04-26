import { semanticCache } from "./cache.js";
import { discoverDeprecationUrl } from "./discovery.js";
import { retrieveDocs } from "./retriever.js";
import { rankChunks } from "./ranker.js";
import { extract } from "./extractor.js";
import { fetchWithTimeout } from "./http.js";
import { formatScanEnvelope } from "./formatter.js";
import { withRetry } from "./retry.js";
import type { DeprecationMatch, ScanResponse } from "./types.js";
import { cacheKey, normalizeText, unique } from "./utils.js";

export function extractApiCalls(fileContent: string): Array<{ name: string; line: number }> {
  const lines = fileContent.split("\n");
  const results: Array<{ name: string; line: number }> = [];
  const seen = new Set<string>();

  const patterns = [
    /import\s*\{([^}]+)\}/g,
    /require\s*\(['"]([\w/@-]+)['"]\)/g,
    /\b([\w]+\.[\w]+)\s*\(/g,
    /\b([A-Z][\w]+)\s*\(/g
  ];

  lines.forEach((line, idx) => {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(line)) !== null) {
        const raw = match[1] ?? "";
        const tokens = raw.includes(",") ? raw.split(",").map((token) => token.trim()) : [raw.trim()];
        for (const token of tokens) {
          const clean = token.replace(/\s+as\s+\w+/, "").trim();
          if (clean.length > 1 && !seen.has(clean)) {
            seen.add(clean);
            results.push({ name: clean, line: idx + 1 });
          }
        }
      }
    }
  });

  return results;
}

export function matchDeprecation(
  apiName: string,
  deprecationText: string
): { reason: string; replacement?: string } | null {
  const lower = deprecationText.toLowerCase();
  const apiLower = apiName.toLowerCase();
  if (!lower.includes(apiLower)) return null;

  const sentences = deprecationText
    .split(/(?<=[.!?])\s+|\n+/)
    .map(normalizeText)
    .filter((sentence) => sentence.toLowerCase().includes(apiLower));

  for (const sentence of sentences) {
    if (/deprecat|removed|no longer|replaced/i.test(sentence)) {
      const replacementMatch = sentence.match(/use\s+([\w.]+)|replaced?\s+(?:by|with)\s+([\w.]+)/i);
      const replacement = replacementMatch?.[1] ?? replacementMatch?.[2];
      return replacement
        ? { reason: sentence.slice(0, 200), replacement }
        : { reason: sentence.slice(0, 200) };
    }
  }

  return null;
}

async function fetchDeprecationText(stack: string): Promise<{ text: string; url: string }> {
  const url = await discoverDeprecationUrl(stack);

  try {
    const response = await fetchWithTimeout(url);
    if (response.ok) {
      const html = await response.text();
      const chunks = extract(html);
      return { text: chunks.join(" ").slice(0, 20000), url };
    }
  } catch {
    // fall through
  }

  const query = `${stack} deprecated api removed migration`;
  const docs = await retrieveDocs([url], query);
  const chunks = rankChunks(docs, query);
  return {
    text: chunks.map((chunk) => chunk.text).join(" ").slice(0, 20000),
    url
  };
}

export async function scan_deprecations(input: {
  fileContent: string;
  stack: string;
  version?: string;
}): Promise<ScanResponse> {
  const version = input.version ?? "latest";
  const key = cacheKey(input.stack, version, `scan:${input.fileContent.slice(0, 200)}`);
  const cached = semanticCache.getCache(key) as ScanResponse | null;

  if (cached && cached.tool === "scan_deprecations") {
    return {
      ...cached,
      cacheStatus: "hit"
    };
  }

  const result = await withRetry(async () => {
    const apiCalls = extractApiCalls(input.fileContent);
    const { text: deprecationText, url: sourceUrl } = await fetchDeprecationText(input.stack);

    const deprecated: DeprecationMatch[] = [];
    const removed: DeprecationMatch[] = [];

    for (const { name, line } of apiCalls) {
      const match = matchDeprecation(name, deprecationText);
      if (!match) continue;

      const isRemoved = /removed|deleted|dropped/i.test(match.reason);
      const entry: DeprecationMatch = match.replacement
        ? { line, api: name, reason: match.reason, replacement: match.replacement }
        : { line, api: name, reason: match.reason };

      if (isRemoved) {
        removed.push(entry);
      } else {
        deprecated.push(entry);
      }
    }

    return formatScanEnvelope({
      stack: input.stack,
      version,
      deprecated,
      removed,
      sources: unique([sourceUrl]),
      cacheStatus: "miss"
    });
  });

  semanticCache.setCache(key, result);
  return result;
}
