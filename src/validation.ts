import type { DocsResponse } from "./types.js";
import { isLikelyOfficialSourceUrl } from "./utils.js";

export function validate(response: DocsResponse): DocsResponse {
  if (!response.stack) {
    throw new Error("Validation failed: stack must exist");
  }

  if (!response.version) {
    throw new Error("Validation failed: version must exist");
  }

  if (!response.sources.length) {
    throw new Error("Validation failed: at least one source is required");
  }

  if (
    !response.sources.some((url) => isLikelyOfficialSourceUrl(url))
  ) {
    throw new Error("Validation failed: at least one official source URL is required");
  }

  if (response.answer.length < 20) {
    throw new Error("Validation failed: answer is too short");
  }

  if (/<[a-z/][\s\S]*>/i.test(response.answer)) {
    throw new Error("Validation failed: answer contains raw HTML");
  }

  return response;
}
