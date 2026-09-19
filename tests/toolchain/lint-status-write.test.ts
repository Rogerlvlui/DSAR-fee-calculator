// tests/toolchain/lint-status-write.test.ts
//
// Proves the T-04-19 status-write ESLint rule (eslint.config.js) fires on
// the fixture's violating lines — both the object-literal-property shape
// and the direct member-expression-assignment shape (04-REVIEW.md WR-03) —
// and stays silent on its negative controls: the two compliant
// executor-destination writes, and a property named `status` carrying a
// rule-pack status value rather than a matter status. A second block below
// proves the rule also fires inside a `.tsx` file, the companion WR-03
// gap. Follows tests/toolchain/lint-money-brand.test.ts's own virtual-path
// technique: each fixture lives outside the rule's real scope
// (apps/web/src/server, apps/web/app), so it is linted under a virtual
// path inside that scope — no file is ever written to disk there, and a
// real `pnpm eslint apps/web` run never sees either fixture at all.

import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const FIXTURE_PATH = path.join(ROOT, "tests/fixtures/status-write-violation.fixture.ts");
const TSX_FIXTURE_PATH = path.join(ROOT, "tests/fixtures/status-write-violation.tsx.fixture.tsx");
const STATUS_WRITE_MESSAGE =
  "A matter's status must be written from the guarded executor's own returned destination, never a literal — route the write through packages/workflow's evaluateTransition().";
const VIRTUAL_PATH = path.join(ROOT, "apps/web/src/server/__status-write-violation.fixture.ts");
const TSX_VIRTUAL_PATH = path.join(ROOT, "apps/web/app/__status-write-violation.fixture.tsx");

async function lintFixture(): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const content = readFileSync(FIXTURE_PATH, "utf-8");
  return eslint.lintText(content, { filePath: VIRTUAL_PATH });
}

async function lintTsxFixture(): Promise<ESLint.LintResult[]> {
  const eslint = new ESLint({ cwd: ROOT });
  const content = readFileSync(TSX_FIXTURE_PATH, "utf-8");
  return eslint.lintText(content, { filePath: TSX_VIRTUAL_PATH });
}

function lineOf(fixtureSource: string, needle: string): number {
  const lines = fixtureSource.split("\n");
  const index = lines.findIndex((line) => line.includes(needle));
  if (index === -1) throw new Error(`fixture line containing '${needle}' not found`);
  return index + 1;
}

describe("STATUS-WRITE-GATE (T-04-19 status-write lint rule)", () => {
  it("STATUS-WRITE-GATE: reports exactly three status-write violations on the fixture", async () => {
    const results = await lintFixture();
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    expect(statusWriteMessages).toHaveLength(3);
  });

  it("STATUS-WRITE-GATE: reports all three violating lines by line number, including the direct member-expression assignment", async () => {
    const results = await lintFixture();
    const fixtureSource = readFileSync(FIXTURE_PATH, "utf-8");
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    const draftLine = lineOf(fixtureSource, 'status: "DRAFT"');
    const signedOffLine = lineOf(fixtureSource, 'status: "SIGNED_OFF"');
    const directAssignmentLine = lineOf(fixtureSource, 'someMatter.status = "COMPUTING"');
    const reportedLines = statusWriteMessages.map((m) => m.line).sort((a, b) => a - b);
    expect(reportedLines).toEqual([draftLine, signedOffLine, directAssignmentLine].sort((a, b) => a - b));
  });

  it("STATUS-WRITE-GATE: the compliant executor-destination write is not reported", async () => {
    const results = await lintFixture();
    const fixtureSource = readFileSync(FIXTURE_PATH, "utf-8");
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    const compliantLine = lineOf(fixtureSource, "status: outcome.to");
    const matches = statusWriteMessages.filter((m) => m.line === compliantLine);
    expect(matches, "expected no report on the compliant executor-destination write").toHaveLength(0);
  });

  it("STATUS-WRITE-GATE: the compliant direct member-expression assignment using the executor's destination is not reported", async () => {
    const results = await lintFixture();
    const fixtureSource = readFileSync(FIXTURE_PATH, "utf-8");
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    const compliantAssignmentLine = lineOf(fixtureSource, "matter.status = outcome.to");
    const matches = statusWriteMessages.filter((m) => m.line === compliantAssignmentLine);
    expect(matches, "expected no report on the compliant member-expression assignment").toHaveLength(0);
  });

  it("STATUS-WRITE-GATE: a property named status carrying a rule-pack status value is not reported", async () => {
    const results = await lintFixture();
    const fixtureSource = readFileSync(FIXTURE_PATH, "utf-8");
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    const rulePackStatusLine = lineOf(fixtureSource, 'status: "ACTIVE"');
    const matches = statusWriteMessages.filter((m) => m.line === rulePackStatusLine);
    expect(matches, "expected no report on the rule-pack status value").toHaveLength(0);
  });
});

describe("STATUS-WRITE-GATE (.tsx coverage — 04-REVIEW.md WR-03)", () => {
  it("STATUS-WRITE-GATE: fires on a literal status write inside a .tsx file", async () => {
    const results = await lintTsxFixture();
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    expect(statusWriteMessages).toHaveLength(1);
  });

  it("STATUS-WRITE-GATE: reports the .tsx violation on the correct line", async () => {
    const results = await lintTsxFixture();
    const fixtureSource = readFileSync(TSX_FIXTURE_PATH, "utf-8");
    const statusWriteMessages = results.flatMap((r) =>
      r.messages.filter((m) => m.message === STATUS_WRITE_MESSAGE)
    );
    const draftLine = lineOf(fixtureSource, 'status: "DRAFT"');
    expect(statusWriteMessages.map((m) => m.line)).toEqual([draftLine]);
  });
});
