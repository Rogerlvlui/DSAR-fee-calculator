// packages/rulepacks/scripts/validate-cli.ts
//
// Entry point for the root `pack:validate` npm script. Thin script wrapping
// `validateAllRulePacks()` — no CLI framework, matching
// packages/schemas/scripts/generate-json-schema.ts's pattern. Prints one
// line per pack loaded on success; on a thrown validation or parse failure,
// prints the message to stderr and exits with code 1 — this is the build
// failure Success Criterion 1 requires (PRD §7.3).

import { loadAllRulePacks, RULEPACKS_ROOT } from "../src/loader.ts";
import { validateAllRulePacks } from "../src/validate.ts";

function main(): void {
  try {
    const packs = loadAllRulePacks(RULEPACKS_ROOT);
    validateAllRulePacks(RULEPACKS_ROOT);
    for (const pack of packs) {
      console.log(`loaded and validated pack: ${pack.packId} (${pack.version})`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
