import * as cheerio from "cheerio";
import { config } from "./config.js";
import { fetchWithTimeout } from "./http.js";
import type { RetrievedDocument, SourceType } from "./types.js";
import { isLikelyOfficialSourceUrl, normalizeText, safeHostname, toAbsoluteUrl, unique } from "./utils.js";

function inferSourceType(url: string): SourceType {
  const normalized = url.toLowerCase();

  if (/(blog|news)/.test(normalized) && isLikelyOfficialSourceUrl(url)) {
    return "official";
  }

  if (/(api|reference)/.test(normalized)) {
    return "api";
  }

  if (/(example|examples|tutorial|learn)/.test(normalized)) {
    return "example";
  }

  if (/(blog|medium|dev\.to|news)/.test(normalized)) {
    return "blog";
  }

  return "official";
}

function scoreCandidateLink(query: string, href: string, anchorText: string): number {
  const normalized = `${href} ${anchorText}`.toLowerCase();
  const keywords = [...new Set((query.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((part) => part.length >= 3))];
  const overlap = keywords.reduce((count, keyword) => count + (normalized.includes(keyword) ? 1 : 0), 0);
  let score = overlap * 2;

  if (/(docs|guide|reference|api|learn)/.test(normalized)) {
    score += 3;
  }

  if (query.toLowerCase().includes("cookies") && normalized.includes("cookies")) {
    score += 6;
  }

  if (query.toLowerCase().includes("server actions") && normalized.includes("server")) {
    score += 4;
  }

  if (/(blog|changelog|release)/.test(normalized)) {
    score -= 3;
  }

  return score;
}

async function discoverRelatedUrls(baseUrl: string, query: string): Promise<string[]> {
  const response = await fetchWithTimeout(baseUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch base docs page ${baseUrl}: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const hostname = safeHostname(baseUrl);
  const candidates: Array<{ url: string; score: number }> = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")?.trim();
    if (!href) {
      return;
    }

    const absolute = toAbsoluteUrl(baseUrl, href);
    if (!absolute || safeHostname(absolute) !== hostname) {
      return;
    }

    const score = scoreCandidateLink(query, absolute, $(element).text());
    if (score <= 0) {
      return;
    }

    candidates.push({ url: absolute, score });
  });

  const topRelated = candidates
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, Math.max(0, config.maxRetrievedPages - 1))
    .map((candidate) => candidate.url);

  return unique([baseUrl, ...topRelated]);
}

export async function retrieveDocs(urls: string[], query: string): Promise<RetrievedDocument[]> {
  const expanded = unique(
    (
      await Promise.all(
        urls.map(async (url) => {
          try {
            return await discoverRelatedUrls(url, query);
          } catch {
            return [url];
          }
        })
      )
    ).flat()
  ).slice(0, config.maxRetrievedPages);

  const documents = await Promise.all(
    expanded.map(async (url) => {
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch docs page ${url}: ${response.status}`);
      }

      const html = await response.text();
      return {
        url,
        html,
        sourceType: inferSourceType(url)
      };
    })
  );

  return documents;
}
