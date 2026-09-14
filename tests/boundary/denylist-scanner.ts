// tests/boundary/denylist-scanner.ts
//
// AC-06 / BOUND-02 / T-1-PII: the single normalize-and-match implementation
// both the Prisma field test and the DOM test import. Imports
// PERSONAL_DATA_DENY_LIST from packages/schemas rather than restating it,
// so widening the constant automatically widens both checks.

import { PERSONAL_DATA_DENY_LIST } from "@dsar/schemas/constants";

/**
 * Normalizes a field/attribute name for deny-list comparison. Order matters:
 * Unicode NFKC normalize (so a full-width or compatibility-decomposable
 * spelling collapses to its ASCII equivalent), THEN lowercase, THEN strip
 * every non-alphanumeric character.
 */
export function normalizeFieldName(name: string): string {
  return name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Splits a name into its constituent "words" along camelCase, snake_case,
 * kebab-case and whitespace boundaries, lowercased (after NFKC).
 *
 * This exists because `normalizeFieldName`'s blanket strip discards exactly
 * the boundaries needed to tell "a field whose name is built from the
 * deny-listed word(s)" apart from "a field whose name merely contains a
 * short deny-list token as a bare substring of an unrelated English word" —
 * e.g. `finalAmount` (a required, frozen AC-25 field) contains "fin" as a
 * substring but is not built from the word "fin". `findDenyListViolations`
 * checks contiguous *word* concatenations against the deny list, never raw
 * substrings of the flattened name, precisely to avoid that false positive
 * while still catching `requestorName`, `employeeId`, `dateOfBirth`, and a
 * bare `fin`/`nric` field.
 */
function splitIntoWords(name: string): string[] {
  return name
    .normalize("NFKC")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 0);
}

/**
 * Checks every name in `names` against `denyList` (defaults to the frozen
 * PERSONAL_DATA_DENY_LIST) and reports every name for which some contiguous
 * run of its constituent words, concatenated, exactly equals a normalized
 * deny-list token.
 *
 * - A name matching more than one token is reported exactly once, with the
 *   alphabetically-first matching token — so the deny-list's own ordering
 *   (or a caller-supplied shuffle of it) never changes which names are
 *   reported or which token is named as the match.
 * - An empty `names` array returns `[]` without throwing.
 */
export function findDenyListViolations(
  names: string[],
  denyList: readonly string[] = PERSONAL_DATA_DENY_LIST
): { name: string; matched: string }[] {
  const normalizedTokens = denyList
    .map((token) => ({ token, normalized: normalizeFieldName(token) }))
    .filter((entry) => entry.normalized.length > 0);

  const results: { name: string; matched: string }[] = [];

  for (const rawName of names) {
    const words = splitIntoWords(rawName);
    if (words.length === 0) continue;

    const matchedTokens = new Set<string>();
    for (let start = 0; start < words.length; start++) {
      let acc = "";
      for (let end = start; end < words.length; end++) {
        acc += words[end];
        for (const entry of normalizedTokens) {
          if (entry.normalized === acc) matchedTokens.add(entry.token);
        }
      }
    }

    if (matchedTokens.size > 0) {
      const matched = [...matchedTokens].sort((a, b) => a.localeCompare(b))[0]!;
      results.push({ name: rawName, matched });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
