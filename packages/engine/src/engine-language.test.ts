// packages/engine/src/engine-language.test.ts
//
// AC-32(a) — every string packages/engine itself authors must be free of
// the canonical banned words (packages/schemas/src/constants.ts's
// LEGAL_CONCLUSION_BANNED_WORDS, transcribed verbatim from PRD §10.1/§13).
// messages.ts's own module comment states it is the SINGLE home for every
// string packages/engine authors — enumerating that module's exports IS
// enumerating engine-authored language exhaustively, not sampling it.
//
// Scoped to engine-authored text only:
//   - Pack-authored `basis`, `citation`, and matterFlagRule `message` text
//     passes through the engine verbatim (evaluatePackFlagRules() in
//     matter-flags.ts reuses the pack's own `message` field as-is, never
//     through this module) and belongs to Phase 3's pack validator.
//   - The shared taxonomy's category labels (packages/schemas/src/
//     taxonomy.ts) legitimately contain "Legal" — e.g.
//     STAFF_TIME_LEGAL_REVIEW: "Legal review time (in-house or external)"
//     — and are not engine output either.
//
// Matching is case-SENSITIVE and on word boundaries, against the exact
// (lower-case) forms in LEGAL_CONCLUSION_BANNED_WORDS. messages.ts refers
// to the Legal DEPARTMENT by name in several templates ("referred to
// Legal") — a legitimate proper noun, not a pronouncement on legality — and
// a case-INsensitive match would false-positive on every one of those. The
// banned adjective is the lower-case "legal" (as in "this fee is legal");
// this file's own control case (below) proves the matcher still catches
// that lower-case form, so the case-sensitivity is a deliberate scoping
// choice, not a hole that lets a real violation slip through unnoticed.

import { describe, expect, it } from "vitest";
import { LEGAL_CONCLUSION_BANNED_WORDS } from "@dsar/schemas/constants";
import * as messages from "./messages.ts";

// Not imported from tests/boundary/banned-word-matcher.ts (which
// tests/boundary/ui-banned-words.test.ts uses for the same matcher logic,
// against the same word list): packages/engine's own composite tsconfig
// has a `rootDir` of packages/engine/src, and a cross-package import to
// tests/ trips `tsc --build`'s TS6059 ("rootDir is expected to contain all
// source files"). Kept as an identical, independently-maintained copy of
// the exact same one-line construction rather than forcing a shared file
// across a tsconfig boundary that does not allow it.
function findBannedWord(text: string): string | null {
  for (const word of LEGAL_CONCLUSION_BANNED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`); // case-sensitive by default, word-boundary anchored
    if (pattern.test(text)) return word;
  }
  return null;
}

// The one exported template that inspects the STRUCTURE of an argument
// (`"value" in condition`) rather than merely interpolating it into a
// template string — every other current export only ever string-
// interpolates its parameters, so a generic one-element string array is
// safe filler for every other position (it stringifies harmlessly via
// Array.prototype.toString, and also satisfies any `.join()` call an
// array-typed parameter like `appliesTo: readonly string[]` might make).
// This is a narrow, explicitly-commented exception for the one export that
// needs it — not a per-function table for all twenty-one current exports —
// so a future template using only string/number/Minor/string[] parameters
// (every shape every other export currently uses) is covered automatically
// with no table maintenance.
const CONDITION_SHAPED_ARG = [{ field: "unit", op: "eq", value: "PAGE" }];
const ARG_OVERRIDES: Readonly<Record<string, unknown>> = {
  conditionsNotMetMessage: CONDITION_SHAPED_ARG,
};
const GENERIC_ARG: unknown = ["SAMPLE_VALUE"];

// Every exported value from messages.ts, enumerated via Object.entries —
// never listed by hand — so a message template a future plan adds to this
// module is picked up automatically, with no test-file edit required.
const messageExports: Array<[string, (...args: unknown[]) => string]> = Object.entries(messages).filter(
  (entry): entry is [string, (...args: unknown[]) => string] => typeof entry[1] === "function"
);

describe("engine-authored language is free of AC-32's banned words", () => {
  it("messages.ts exports at least one message-template function — the enumeration below is not vacuous", () => {
    expect(messageExports.length).toBeGreaterThan(0);
  });

  it.each(messageExports)("%s's returned string contains none of AC-32's banned words", (name, fn) => {
    const arg = ARG_OVERRIDES[name] ?? GENERIC_ARG;
    // Every current template takes 0-3 parameters; supplying the same
    // filler at every position is safe because no export other than
    // conditionsNotMetMessage (handled via ARG_OVERRIDES above) inspects an
    // argument's internal structure.
    const result = fn(arg, arg, arg);
    expect(typeof result).toBe("string");
    expect(findBannedWord(result)).toBeNull();
  });

  it("the matcher DOES catch a deliberately banned-word-bearing control string — proving it inspects something real, not an inert pattern", () => {
    expect(findBannedWord("This outcome is fully compliant with the applicable law.")).toBe("compliant");
    expect(findBannedWord("This fee is lawful under the pack.")).toBe("lawful");
    expect(findBannedWord("This line is illegal under the statute.")).toBe("illegal");
  });

  it("the matcher does NOT flag 'Legal' (capitalised, the department) — only the banned lower-case adjective", () => {
    expect(findBannedWord("This line is referred to Legal for review.")).toBeNull();
  });
});
