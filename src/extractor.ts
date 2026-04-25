import * as cheerio from "cheerio";
import { normalizeText } from "./utils.js";

const removableSelectors = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "header",
  "aside",
  "iframe",
  "form",
  "[role='navigation']",
  "[aria-label*='cookie' i]",
  "[class*='cookie' i]",
  "[id*='cookie' i]",
  "[class*='consent' i]",
  "[id*='consent' i]",
  "[class*='subscribe' i]",
  "[id*='subscribe' i]",
  "[class*='newsletter' i]",
  "[id*='newsletter' i]",
  "[class*='banner' i]",
  "[id*='banner' i]"
] as const;

export function extract(html: string): string[] {
  const $ = cheerio.load(html);

  for (const selector of removableSelectors) {
    $(selector).remove();
  }

  const root = $("main, article, [role='main']").first().length
    ? $("main, article, [role='main']").first()
    : $("body");

  const text = normalizeText(root.text());

  return text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((line) => normalizeText(line))
    .filter((line) => line.length >= 25 && !/<[a-z/][\s\S]*>/i.test(line));
}

export function extractCodeBlocks(html: string): string | undefined {
  return extractRelevantCodeBlocks(html)[0];
}

export function extractRelevantCodeBlocks(html: string): string[] {
  const $ = cheerio.load(html);
  const blocks = $("pre code, pre")
    .toArray()
    .map((node) => $(node).text().trim())
    .filter((value) => value.length >= 10);

  return blocks;
}
