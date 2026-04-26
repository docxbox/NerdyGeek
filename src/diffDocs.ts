import * as cheerio from "cheerio";
import { semanticCache } from "./cache.js";
import { cacheKey, normalizeText, unique } from "./utils.js";
import { fetchWithTimeout } from "./http.js";
import { discoverChangelogUrl } from "./discovery.js";
import { formatDiffDocsEnvelope } from "./formatter.js";
import { retrieveDocs } from "./retriever.js";
import { rankChunks } from "./ranker.js";
import { withRetry } from "./retry.js";
import type { DiffEntry, DiffResponse, RetrievedDocument } from "./types.js";

const deprecationSignals = [/deprecat/i, /no\s+longer\s+supported/i, /migration\s+guide/i, /upgrade\s+guide/i];
const newFeatureSignals = [/added/i, /introduced/i, /new\s+in/i, /feat(?:ure)?:/i, /support\s+for/i];
const removedSignals = [/removed/i, /deleted/i, /dropped/i];
const breakingSignals = [/breaking/i, /incompatible/i, /must\s+now/i, /no\s+longer/i];

export function classifyChunk(text: string): DiffEntry["type"] | null {
  if (removedSignals.some((rule) => rule.test(text))) return "removed";
  if (deprecationSignals.some((rule) => rule.test(text))) return "deprecated";
  if (breakingSignals.some((rule) => rule.test(text))) return "breaking";
  if (newFeatureSignals.some((rule) => rule.test(text))) return "new";
  return null;
}

function scoreDiffDocument(document: RetrievedDocument, stack: string, fromVersion: string, toVersion: string): number {
  const url = document.url.toLowerCase();
  const text = normalizeText(document.html.replace(/<[^>]+>/g, " ")).toLowerCase().slice(0, 12000);
  const combined = `${url} ${text}`;
  let score = 0;

  if (/(upgrade|migration)/.test(url)) score += 12;
  if (/(changelog|release|releases|blog)/.test(url)) score += 4;
  if (combined.includes(`${stack.toLowerCase()} ${toVersion.toLowerCase()}`)) score += 10;
  if (combined.includes(`${stack.toLowerCase()} ${fromVersion.toLowerCase()}`)) score += 4;
  if (combined.includes(`v${toVersion.toLowerCase()}`) || combined.includes(`version ${toVersion.toLowerCase()}`)) score += 8;
  if (combined.includes(`v${fromVersion.toLowerCase()}`) || combined.includes(`version ${fromVersion.toLowerCase()}`)) score += 3;
  if (/(breaking|deprecated|removed|upgrade guide|migration guide)/.test(combined)) score += 6;
  if (/read more|you can also follow|posted here first/.test(combined)) score -= 8;

  return score;
}

export function chooseBestDiffDocument(
  documents: RetrievedDocument[],
  stack: string,
  fromVersion: string,
  toVersion: string
): RetrievedDocument | undefined {
  return documents
    .map((document) => ({
      document,
      score: scoreDiffDocument(document, stack, fromVersion, toVersion)
    }))
    .sort((a, b) => b.score - a.score || a.document.url.localeCompare(b.document.url))[0]?.document;
}

function headingType(heading: string): DiffEntry["type"] | null {
  const lower = heading.toLowerCase();
  if (/(removed|removal)/.test(lower)) return "removed";
  if (/(deprecat|sunsetting)/.test(lower)) return "deprecated";
  if (/(breaking|behavior|behaviour|changed|changes)/.test(lower)) return "breaking";
  if (/(new|added|introduced|feature)/.test(lower)) return "new";
  return null;
}

function toEntryDescription(heading: string, text: string): string {
  const normalizedHeading = normalizeText(heading);
  const normalizedText = normalizeText(text);

  if (!normalizedHeading) return normalizedText;
  if (normalizedText.toLowerCase().startsWith(normalizedHeading.toLowerCase())) return normalizedText;
  return `${normalizedHeading}: ${normalizedText}`;
}

export function extractStructuredDiffEntries(html: string): DiffEntry[] {
  const $ = cheerio.load(html);
  const root = $("main, article, [role='main']").first().length
    ? $("main, article, [role='main']").first()
    : $("body");
  const entries: DiffEntry[] = [];

  root.find("h2, h3, h4").each((_, element) => {
    const heading = normalizeText($(element).text());
    const inheritedType = headingType(heading);

    if (!heading || /upgrade guide$/i.test(heading)) {
      return;
    }

    const siblingTexts = $(element)
      .nextUntil("h2, h3, h4")
      .toArray()
      .flatMap((node) => {
        const current = $(node);
        if (current.is("ul, ol")) {
          return current
            .find("li")
            .toArray()
            .map((li) => normalizeText($(li).text()));
        }

        return [normalizeText(current.text())];
      })
      .filter((text) => text.length >= 20);

    for (const text of siblingTexts) {
      const type = inheritedType ?? classifyChunk(text);
      if (!type) continue;
      const description = toEntryDescription(heading, text);
      if (!entries.some((entry) => entry.type === type && entry.description === description)) {
        entries.push({ type, description });
      }
    }
  });

  return entries;
}

function extractVersionSection(html: string, fromVersion: string, toVersion: string): string {
  const $ = cheerio.load(html);
  const text = normalizeText($("main, article, body").first().text());
  const vFrom = fromVersion.replace(/\./g, "\\.");
  const vTo = toVersion.replace(/\./g, "\\.");
  const sectionPattern = new RegExp(`${vTo}[\\s\\S]{0,8000}?(?=${vFrom}|$)`, "i");
  const match = text.match(sectionPattern);
  return match?.[0] ?? text.slice(0, 6000);
}

export async function diff_docs(input: {
  stack: string;
  fromVersion: string;
  toVersion: string;
}): Promise<DiffResponse> {
  const key = cacheKey(input.stack, `${input.fromVersion}->${input.toVersion}`, `diff:${input.stack}`);
  const cached = semanticCache.getCache(key) as DiffResponse | null;
  if (cached && cached.tool === "diff_docs") {
    return {
      ...cached,
      cacheStatus: "hit"
    };
  }

  const result = await withRetry(async () => {
    const changelogUrl = await discoverChangelogUrl(input.stack);
    const query =
      `${input.stack} ${input.fromVersion} to ${input.toVersion} ` +
      "upgrade guide migration breaking changes deprecated removed";
    let bestSourceUrl = changelogUrl;
    let sectionText = "";

    try {
      const response = await fetchWithTimeout(changelogUrl);
      if (response.ok) {
        const html = await response.text();
        sectionText = extractVersionSection(html, input.fromVersion, input.toVersion);
      }
    } catch {
      // fall through
    }

    const docs = await retrieveDocs([changelogUrl], query);
    const bestDocument = chooseBestDiffDocument(docs, input.stack, input.fromVersion, input.toVersion);
    let structuredEntries: DiffEntry[] = [];

    if (bestDocument) {
      bestSourceUrl = bestDocument.url;
      structuredEntries = extractStructuredDiffEntries(bestDocument.html);
      try {
        const focusedSection = extractVersionSection(bestDocument.html, input.fromVersion, input.toVersion);
        if (focusedSection.length > sectionText.length || /(upgrade|migration|breaking|deprecated|removed)/i.test(focusedSection)) {
          sectionText = focusedSection;
        }
      } catch {
        // ignore
      }
    }

    const changes: DiffEntry[] = [];
    for (const entry of structuredEntries.slice(0, 24)) {
      if (!changes.some((existing) => existing.type === entry.type && existing.description === entry.description)) {
        changes.push(entry);
      }
    }

    if (changes.length === 0 && sectionText) {
      const sentences = sectionText
        .split(/(?<=[.!?])\s+|\n+/)
        .map(normalizeText)
        .filter((sentence) => sentence.length > 20);

      for (const sentence of sentences.slice(0, 40)) {
        const type = classifyChunk(sentence);
        if (type && !changes.some((existing) => existing.description === sentence)) {
          changes.push({ type, description: sentence });
        }
      }
    }

    if (changes.length === 0 && sectionText.length > 0) {
      changes.push({
        type: "breaking",
        description: `See official migration guide: ${bestSourceUrl}`
      });
    }

    return formatDiffDocsEnvelope({
      stack: input.stack,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      changes,
      sources: unique([bestSourceUrl, changelogUrl]),
      cacheStatus: "miss"
    });
  });

  semanticCache.setCache(key, result);
  return result;
}
