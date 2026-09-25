// apps/web/src/domain/expense-description.ts
//
// An OTHER_UNCLASSIFIED ("Something else") line is always FLAGged for Legal
// (AC-19), and HR's description is the only thing Legal has to classify it
// from — so it must say something. Counted the same way as a disposition
// reason (non-whitespace characters), so "misc" or "x" is refused.

import type { ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import { countNonWhitespaceChars } from "./disposition-actions.ts";

export const MIN_OTHER_DESCRIPTION_NON_WHITESPACE_CHARS = 10;

export const OTHER_UNCLASSIFIED_DESCRIPTION_HINT =
  "Describe what this cost was — Legal decides how to treat it from your words. " +
  "Check first whether a listed category fits (e.g. courier fees go under “Postage, courier, delivery”). " +
  "Do not include names, addresses or other personal data.";

export function hasSufficientDescriptionForCategory(
  categoryCode: ExpenseCategoryCode,
  description: string
): boolean {
  if (categoryCode !== "OTHER_UNCLASSIFIED") return true;
  return countNonWhitespaceChars(description) >= MIN_OTHER_DESCRIPTION_NON_WHITESPACE_CHARS;
}
