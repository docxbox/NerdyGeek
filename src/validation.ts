import type { NerdyGeekResponse } from "./types.js";
import { isLikelyOfficialSourceUrl } from "./utils.js";

export function validate<T extends NerdyGeekResponse>(response: T): T {
  if (!response.stack) {
    throw new Error("Validation failed: stack must exist");
  }

  if (!response.version) {
    throw new Error("Validation failed: version must exist");
  }

  if (!response.docHandle) {
    throw new Error("Validation failed: docHandle must exist");
  }

  if (!response.sources.length) {
    throw new Error("Validation failed: at least one source is required");
  }

  if (!response.sources.some((url) => isLikelyOfficialSourceUrl(url))) {
    throw new Error("Validation failed: at least one official source URL is required");
  }

  if (response.summary.length < 20) {
    throw new Error("Validation failed: summary is too short");
  }

  if (/<[a-z/][\s\S]*>/i.test(response.summary)) {
    throw new Error("Validation failed: summary contains raw HTML");
  }

  if (response.actions.some((action) => /<[a-z/][\s\S]*>/i.test(action))) {
    throw new Error("Validation failed: actions contain raw HTML");
  }

  if (response.gotchas.some((gotcha) => /<[a-z/][\s\S]*>/i.test(gotcha))) {
    throw new Error("Validation failed: gotchas contain raw HTML");
  }

  if (response.tool === "search_docs" && response.answer.length < 20) {
    throw new Error("Validation failed: answer is too short");
  }

  return response;
}
