import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const FIXTURE_PATH = path.join(
  ROOT,
  "tests/fixtures/engine-determinism-violation.fixture.ts"
);

// The fixture lives under tests/fixtures/, outside the engine-scoped rule's
// real `files` glob (packages/engine/**/*.ts). ESLint's flat-config `files`
// matching is driven entirely by the `filePath` passed to lintText — so we
// lint the fixture's real content under a *virtual* path inside
// packages/engine/src (and, for the scoping check, packages/schemas/src).
// No file is ever written to disk; a real `pnpm run lint` run never sees
// this fixture at all.
const ENGINE_VIRTUAL_PATH = path.join(
  ROOT,
  "packages/engine/src/__engine-determinism-violation.fixture.ts"
);
const SCHEMAS_VIRTUAL_PATH = path.join(
  ROOT,
  "packages/schemas/src/__engine-determinism-violation.fixture.ts"
);

// Mirrors the messages defined in eslint.config.js — kept as literal copies
// (not an import) so this test also catches a message string silently
// drifting out of sync with the config.
const DATE_BAN_MESSAGE =
  "packages/engine reads time only through the injected `now` (PRD §8.1) — `Date` is banned here.";
const INTL_BAN_MESSAGE =
  "Locale-dependent output would make the same input produce different results on a different host — `Intl` is banned in packages/engine.";
const CRYPTO_BAN_MESSAGE =
  "Identifiers must be derived from inputs, not randomness — `crypto` is banned in packages/engine.";
const MATH_RANDOM_BAN_MESSAGE =
  "packages/engine must be deterministic — `Math.random` is banned here (Math itself, e.g. Math.floor, remains allowed).";
const LOCALE_METHOD_BAN_MESSAGE =
  "Locale-dependent formatting would make the same input produce different results on a different host — `toLocale*` calls are banned in packages/engine.";
const MONEY_BRAND_MESSAGE =
  "Money-named identifiers must use the branded Minor type, not number.";

const DETERMINISM_MESSAGES = [
  DATE_BAN_MESSAGE,
  INTL_BAN_MESSAGE,
  CRYPTO_BAN_MESSAGE,
  MATH_RANDOM_BAN_MESSAGE,
  LOCALE_METHOD_BAN_MESSAGE,
];

async function lintFixture(filePath: string): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const content = readFileSync(FIXTURE_PATH, "utf-8");
  return eslint.lintText(content, { filePath });
}

// `no-restricted-globals` and `no-restricted-properties` prepend their own
// fixed "Unexpected use of 'X'." / "'X' is restricted from being used."
// prefix ahead of the configured custom message (confirmed against the
// installed eslint@10.10.0 rule source) — `no-restricted-syntax` does not.
// Matching by substring, rather than exact equality, is correct for both
// shapes and does not depend on which rule produced the message.
function messagesFor(results: ESLint.LintResult[], text: string) {
  return results.flatMap((r) => r.messages.filter((m) => m.message.includes(text)));
}

// Locates the 1-indexed source line containing `needle`, so assertions do
// not hard-code a line number a later edit would silently invalidate.
function lineOf(source: string, needle: string): number {
  const lines = source.split("\n");
  const idx = lines.findIndex((l) => l.includes(needle));
  if (idx === -1) {
    throw new Error(`fixture line not found for needle: ${needle}`);
  }
  return idx + 1;
}

describe("packages/engine determinism-ban lint rules (T-2-07)", () => {
  const source = readFileSync(FIXTURE_PATH, "utf-8");

  it("reports each of the six determinism bans on its own dedicated fixture line", async () => {
    const results = await lintFixture(ENGINE_VIRTUAL_PATH);

    // Date is banned via a single no-restricted-globals entry, so both the
    // clock-construction and clock-read constructs share DATE_BAN_MESSAGE —
    // two distinct lines, same message text.
    const dateMessages = messagesFor(results, DATE_BAN_MESSAGE);
    const constructionLine = lineOf(source, "new Date()");
    const readLine = lineOf(source, "Date.now()");
    expect(dateMessages).toHaveLength(2);
    expect(dateMessages.map((m) => m.line).sort()).toEqual(
      [constructionLine, readLine].sort()
    );

    const singleOccurrenceCases: Array<[string, string]> = [
      [MATH_RANDOM_BAN_MESSAGE, "Math.random()"],
      [CRYPTO_BAN_MESSAGE, "crypto.randomUUID()"],
      [INTL_BAN_MESSAGE, "Intl.DateTimeFormat"],
      [LOCALE_METHOD_BAN_MESSAGE, "toLocaleString()"],
    ];
    for (const [message, needle] of singleOccurrenceCases) {
      const matches = messagesFor(results, message);
      expect(matches, `expected exactly one report for: ${message}`).toHaveLength(1);
      expect(matches[0]?.line).toBe(lineOf(source, needle));
    }
  });

  it("reports zero problems on the three negative-control lines", async () => {
    const results = await lintFixture(ENGINE_VIRTUAL_PATH);
    const allMessages = results.flatMap((r) => r.messages);
    const negativeControlNeedles = [
      "performance.now()",
      "Math.floor(1.9)",
      'const requestedDate = "2026-09-15"',
    ];
    for (const needle of negativeControlNeedles) {
      const controlLine = lineOf(source, needle);
      const matches = allMessages.filter((m) => m.line === controlLine);
      expect(matches, `expected no report on negative-control line: ${needle}`).toHaveLength(0);
    }
  });

  it("still reports the AC-07a money-brand message for a packages/engine virtual path", async () => {
    const results = await lintFixture(ENGINE_VIRTUAL_PATH);
    const moneyBrandMessages = messagesFor(results, MONEY_BRAND_MESSAGE);
    expect(moneyBrandMessages.length).toBeGreaterThanOrEqual(1);
  });

  it("does not report any determinism message for a packages/schemas virtual path, while still reporting the money-brand message", async () => {
    const results = await lintFixture(SCHEMAS_VIRTUAL_PATH);
    for (const message of DETERMINISM_MESSAGES) {
      expect(messagesFor(results, message)).toHaveLength(0);
    }
    expect(messagesFor(results, MONEY_BRAND_MESSAGE).length).toBeGreaterThanOrEqual(1);
  });
});
