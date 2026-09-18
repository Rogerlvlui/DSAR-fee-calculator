// apps/web/src/server/rulepacks-root.ts
//
// packages/rulepacks/src/loader.ts's default RULEPACKS_ROOT constant derives
// from the loader module's own directory, which points inside Next's build
// output once the module is bundled — and the process working directory
// differs between the Next dev server (this app's own package directory)
// and Vitest (the repository root). Walking upward from the actual process
// cwd, looking for a directory containing packages/rulepacks/SG-PDPA, is
// correct under both.

import "./server-only.ts";
import { existsSync } from "node:fs";
import path from "node:path";

export function resolveRulepacksRoot(): string {
  const tried: string[] = [];
  let dir = process.cwd();

  for (;;) {
    const candidate = path.join(dir, "packages", "rulepacks", "SG-PDPA");
    tried.push(candidate);
    if (existsSync(candidate)) {
      return path.join(dir, "packages", "rulepacks");
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `resolveRulepacksRoot: could not find packages/rulepacks/SG-PDPA above any of: ${tried.join(", ")}`
      );
    }
    dir = parent;
  }
}
