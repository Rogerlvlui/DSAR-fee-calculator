import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

const EXACT_VERSION = /^\d+\.\d+\.\d+$/;

function readRootPackageJson(): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const raw = readFileSync(path.join(ROOT, "package.json"), "utf-8");
  return JSON.parse(raw);
}

describe("toolchain pins (T-1-SC-PRERELEASE)", () => {
  const pkg = readRootPackageJson();
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  it("pins typescript to an exact 6.x version", () => {
    const version = allDeps["typescript"];
    expect(version).toBeDefined();
    expect(version).toMatch(EXACT_VERSION);
    expect(version.split(".")[0]).toBe("6");
  });

  it("pins prisma to an exact version (never a range or prerelease)", () => {
    const version = allDeps["prisma"];
    expect(version).toBeDefined();
    expect(version).toMatch(EXACT_VERSION);
  });

  it("pins @prisma/client to an exact version (never a range or prerelease)", () => {
    const version = allDeps["@prisma/client"];
    expect(version).toBeDefined();
    expect(version).toMatch(EXACT_VERSION);
  });

  it("has no ranged (^, ~, >, latest) versions anywhere in dependencies/devDependencies", () => {
    for (const [name, version] of Object.entries(allDeps)) {
      // Internal pnpm workspace packages (e.g. @dsar/schemas) are linked by
      // the workspace protocol, not resolved off the npm registry — they
      // cannot drift to an unreviewed major the way a caret/latest range on
      // an external package can, which is what this test guards against.
      if (version.startsWith("workspace:")) continue;
      expect(version, `${name} must be an exact version, got "${version}"`).toMatch(
        EXACT_VERSION
      );
    }
  });
});
