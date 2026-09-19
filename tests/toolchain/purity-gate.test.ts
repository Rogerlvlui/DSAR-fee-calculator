import { describe, expect, it } from "vitest";
import { cruise } from "dependency-cruiser";
import type { IFlattenedRuleSet, IRegularForbiddenRuleType } from "dependency-cruiser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const CONFIG_PATH = path.join(ROOT, ".dependency-cruiser.cjs");
const require = createRequire(import.meta.url);

// Every rule in .dependency-cruiser.cjs is a plain `from`/`to` rule (not a
// reachability or dependents rule), so the narrower `IRegularForbiddenRuleType`
// — dependency-cruiser's own exported type, not a hand-rolled stand-in — is
// the accurate shape here and structurally requires the same `to` restriction
// the real config already provides.
function loadConfig(): {
  forbidden: IRegularForbiddenRuleType[];
  options?: Record<string, unknown>;
} {
  delete require.cache[require.resolve(CONFIG_PATH)];
  return require(CONFIG_PATH);
}

async function runCruise(
  targets: string[],
  ruleSet: IFlattenedRuleSet
): Promise<{ exitCode: number; output: string }> {
  const result = await cruise(
    targets,
    {
      validate: true,
      ruleSet,
      outputType: "err-long",
      doNotFollow: { path: "node_modules" },
    },
    undefined,
    undefined
  );
  const output =
    typeof result.output === "string" ? result.output : JSON.stringify(result.output);
  return { exitCode: result.exitCode, output };
}

describe("dependency-cruiser purity gate (T-1-PURITY)", () => {
  it("reports zero violations over the real packages/engine", async () => {
    const cfg = loadConfig();
    const { exitCode } = await runCruise(
      [path.join(ROOT, "packages/engine")],
      { forbidden: cfg.forbidden }
    );
    expect(exitCode).toBe(0);
  });

  it("reports zero violations over the real packages/workflow", async () => {
    const cfg = loadConfig();
    const { exitCode } = await runCruise(
      [path.join(ROOT, "packages/workflow"), path.join(ROOT, "packages/audit")],
      { forbidden: cfg.forbidden }
    );
    expect(exitCode).toBe(0);
  });

  it("reports no-io-in-engine over a violating fixture (gate proven to fire)", async () => {
    // Widen no-io-in-engine's `from` to include the fixture directory, so
    // this proves the RULE fires — a real `depcruise packages/engine` run
    // never sees the fixture (it lives under tests/fixtures/).
    const cfg = loadConfig();
    const widenedForbidden = cfg.forbidden.map((rule) =>
      rule.name === "no-io-in-engine"
        ? {
            ...rule,
            from: { path: "^(packages/engine|tests/fixtures/engine-io-violation)" },
          }
        : rule
    );

    const { exitCode, output } = await runCruise(
      [path.join(ROOT, "packages/engine"), path.join(ROOT, "tests/fixtures/engine-io-violation")],
      { forbidden: widenedForbidden }
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain("no-io-in-engine");
  });

  it("reports no-money-formatting-in-engine over a violating fixture (gate proven to fire)", async () => {
    // Widen no-money-formatting-in-engine's `from` to include the fixture
    // directory, so this proves the RULE fires — a real
    // `depcruise packages/engine packages/schemas` run never sees the
    // fixture (it lives under tests/fixtures/).
    const cfg = loadConfig();
    const widenedForbidden = cfg.forbidden.map((rule) =>
      rule.name === "no-money-formatting-in-engine"
        ? {
            ...rule,
            from: {
              path: "^(packages/engine|tests/fixtures/engine-money-format-violation)",
            },
          }
        : rule
    );

    const { exitCode, output } = await runCruise(
      [
        path.join(ROOT, "packages/engine"),
        path.join(ROOT, "packages/schemas"),
        path.join(ROOT, "tests/fixtures/engine-money-format-violation"),
      ],
      { forbidden: widenedForbidden }
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain("no-money-formatting-in-engine");
  });

  it("reports no-io-in-workflow over a violating fixture (gate proven to fire)", async () => {
    // Widen no-io-in-workflow's `from` to include the fixture directory, so
    // this proves the RULE fires — a real `depcruise packages/workflow`
    // run never sees the fixture (it lives under tests/fixtures/).
    const cfg = loadConfig();
    const widenedForbidden = cfg.forbidden.map((rule) =>
      rule.name === "no-io-in-workflow"
        ? {
            ...rule,
            from: { path: "^(packages/workflow|tests/fixtures/workflow-io-violation)" },
          }
        : rule
    );

    const { exitCode, output } = await runCruise(
      [
        path.join(ROOT, "packages/workflow"),
        path.join(ROOT, "packages/audit"),
        path.join(ROOT, "tests/fixtures/workflow-io-violation"),
      ],
      { forbidden: widenedForbidden }
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain("no-io-in-workflow");
  });

  it("reports no-infra-in-workflow over a violating fixture (gate proven to fire)", async () => {
    // Same widen-the-rule-scope technique, over the same fixture, which
    // also imports @dsar/audit/interface — proving a guard package cannot
    // acquire a dependency on the audit package it must never write
    // through directly.
    const cfg = loadConfig();
    const widenedForbidden = cfg.forbidden.map((rule) =>
      rule.name === "no-infra-in-workflow"
        ? {
            ...rule,
            from: { path: "^(packages/workflow|tests/fixtures/workflow-io-violation)" },
          }
        : rule
    );

    const { exitCode, output } = await runCruise(
      [
        path.join(ROOT, "packages/workflow"),
        path.join(ROOT, "packages/audit"),
        path.join(ROOT, "tests/fixtures/workflow-io-violation"),
      ],
      { forbidden: widenedForbidden }
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain("no-infra-in-workflow");
  });

  it("declares exactly eight forbidden rules, asserted by name", () => {
    // A future edit that renames or drops a rule is caught by name here,
    // rather than surfacing only as a silently-still-zero exit code
    // elsewhere (T-2-10 gate-integrity requirement). Widened from six to
    // eight in 04-02 Task 2, which added no-io-in-workflow and
    // no-infra-in-workflow for the guard package's purity boundary
    // (T-04-10).
    const cfg = loadConfig();
    const names = cfg.forbidden.map((rule) => rule.name);
    expect(names).toEqual([
      "no-io-in-engine",
      "no-infra-in-engine",
      "no-fetch-in-engine",
      "no-money-formatting-in-engine",
      "no-store-impl-in-repository-interface",
      "no-server-imports-in-ui",
      "no-io-in-workflow",
      "no-infra-in-workflow",
    ]);
  });
});
