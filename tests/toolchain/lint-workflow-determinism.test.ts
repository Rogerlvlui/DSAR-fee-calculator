import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const FIXTURE_PATH = path.join(
  ROOT,
  "tests/fixtures/workflow-determinism-violation.fixture.ts"
);

// The fixture lives under tests/fixtures/, outside the workflow-scoped
// rule's real `files` glob (packages/workflow/**/*.ts). ESLint's flat-config
// `files` matching is driven entirely by the `filePath` passed to
// lintText — so we lint the fixture's real content under a *virtual* path
// inside packages/workflow/src (and, for the scoping check, packages/audit/
// src, a sibling new-this-phase package with no determinism ban of its
// own). No file is ever written to disk; a real `pnpm run lint` run never
// sees this fixture at all.
const WORKFLOW_VIRTUAL_PATH = path.join(
  ROOT,
  "packages/workflow/src/__workflow-determinism-violation.fixture.ts"
);
const AUDIT_VIRTUAL_PATH = path.join(
  ROOT,
  "packages/audit/src/__workflow-determinism-violation.fixture.ts"
);

// Mirrors the messages defined in eslint.config.js — kept as literal copies
// (not an import) so this test also catches a message string silently
// drifting out of sync with the config.
const DATE_BAN_MESSAGE =
  "packages/workflow's GuardInput carries no clock at all — `Date` is banned here.";
const INTL_BAN_MESSAGE =
  "Locale-dependent output would make the same input produce different results on a different host — `Intl` is banned in packages/workflow.";
const CRYPTO_BAN_MESSAGE =
  "A guard's outcome must be derived from the frozen GuardInput, not randomness — `crypto` is banned in packages/workflow.";
const MATH_RANDOM_BAN_MESSAGE =
  "packages/workflow must be deterministic — `Math.random` is banned here (Math itself, e.g. Math.floor, remains allowed).";
const LOCALE_METHOD_BAN_MESSAGE =
  "Locale-dependent formatting would make the same input produce different results on a different host — `toLocale*` calls are banned in packages/workflow.";

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
// prefix ahead of the configured custom message (same eslint@10.10.0 rule
// behavior confirmed for the engine's determinism test) —
// `no-restricted-syntax` does not. Matching by substring, rather than exact
// equality, is correct for both shapes and does not depend on which rule
// produced the message.
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

describe("packages/workflow determinism-ban lint rules (T-04-11, WORKFLOW-DETERMINISM)", () => {
  const source = readFileSync(FIXTURE_PATH, "utf-8");

  it("WORKFLOW-DETERMINISM: reports each of the five determinism bans on its own dedicated fixture line", async () => {
    const results = await lintFixture(WORKFLOW_VIRTUAL_PATH);

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

  it("WORKFLOW-DETERMINISM: reports zero problems on the three negative-control lines", async () => {
    const results = await lintFixture(WORKFLOW_VIRTUAL_PATH);
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

  it("WORKFLOW-DETERMINISM: does not report any determinism message for a packages/audit virtual path", async () => {
    // packages/audit is inherently I/O-shaped (a repository) and has no
    // determinism ban of its own (04-02-PLAN.md's assumptions log) — this
    // proves the workflow-scoped block does not leak onto a sibling
    // package it is not anchored to.
    const results = await lintFixture(AUDIT_VIRTUAL_PATH);
    for (const message of DETERMINISM_MESSAGES) {
      expect(messagesFor(results, message)).toHaveLength(0);
    }
  });
});
