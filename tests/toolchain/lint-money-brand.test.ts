import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const FIXTURE_PATH = path.join(ROOT, "tests/fixtures/money-brand-violation.fixture.ts");
const MONEY_BRAND_MESSAGE =
  "Money-named identifiers must use the branded Minor type, not number.";

// The fixture lives under tests/fixtures/, outside the rule's real `files`
// scope (packages/engine, packages/schemas). ESLint's flat-config `files`
// matching is driven entirely by the `filePath` passed to lintText — so we
// lint the fixture's real content under a *virtual* path inside
// packages/engine/src. No file is ever written to disk; a real
// `pnpm eslint packages/engine` run never sees this fixture at all.
const VIRTUAL_PATH = path.join(ROOT, "packages/engine/src/__money-brand-violation.fixture.ts");

async function lintFixture(): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const content = readFileSync(FIXTURE_PATH, "utf-8");
  return eslint.lintText(content, { filePath: VIRTUAL_PATH });
}

describe("AC-07a money-branding lint rule (T-1-MONEY)", () => {
  it("reports exactly five money-branding violations on the fixture", async () => {
    const results = await lintFixture();
    const moneyBrandMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === MONEY_BRAND_MESSAGE)
    );
    expect(moneyBrandMessages).toHaveLength(5);
  });

  it("does not report rateLimit, capacity, or feedback", async () => {
    const results = await lintFixture();
    const fixtureSource = readFileSync(FIXTURE_PATH, "utf-8");
    const lines = fixtureSource.split("\n");
    const allMoneyBrandMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === MONEY_BRAND_MESSAGE)
    );
    for (const name of ["rateLimit", "capacity", "feedback"]) {
      const offendingLine = lines.findIndex((l) => l.includes(name)) + 1;
      const matches = allMoneyBrandMessages.filter((m) => m.line === offendingLine);
      expect(matches, `expected no report naming ${name}`).toHaveLength(0);
    }
  });
});
