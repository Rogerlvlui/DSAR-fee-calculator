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
});
