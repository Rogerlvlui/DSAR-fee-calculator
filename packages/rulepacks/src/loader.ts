// packages/rulepacks/src/loader.ts
//
// The single parse boundary every committed pack crosses (PACK-01/AC-37).
// Pure and synchronous: no clock read (staleness derivation takes an
// injected `now` and lands in plan 03-03, matching packages/engine's
// existing "no clock reads outside an injected `now`" discipline), no
// caching, no network. Every JSON file under a pack directory is parsed
// with `LoadableRulePackSchema` (PD-2) — the PRIMARY shape for every
// committed pack, stub or authored alike. A malformed JSON syntax error or
// a zod shape-violation error both propagate uncaught: a committed pack
// that violates the frozen shape in any way must fail `pnpm test`, not be
// caught and softened into a runtime flag.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { LoadableRulePackSchema, type LoadableRulePack } from "@dsar/schemas/rule-pack";

// Directories under the package root that are never pack directories.
// Fixtures live under `src/__fixtures__` precisely so this glob never sees
// them (T-03-03).
const NON_PACK_DIRECTORIES = new Set(["src", "scripts", "node_modules", "dist"]);

// packages/rulepacks/ — one level up from this file's own `src/` directory.
export const RULEPACKS_ROOT = path.resolve(import.meta.dirname, "..");

export function loadRulePackFile(filePath: string): LoadableRulePack {
  const raw = readFileSync(filePath, "utf-8");
  return LoadableRulePackSchema.parse(JSON.parse(raw));
}

export function loadAllRulePacks(root: string = RULEPACKS_ROOT): LoadableRulePack[] {
  const entries = readdirSync(root, { withFileTypes: true }).filter(
    (entry) => entry.isDirectory() && !NON_PACK_DIRECTORIES.has(entry.name)
  );

  return entries.flatMap((entry) => {
    const packDir = path.join(root, entry.name);
    return readdirSync(packDir)
      .filter((fileName) => fileName.endsWith(".json") && statSync(path.join(packDir, fileName)).isFile())
      .map((fileName) => loadRulePackFile(path.join(packDir, fileName)));
  });
}
