// packages/schemas/scripts/generate-json-schema.ts
//
// Entry point for the root `schema:json` npm script (SCHEMA-05). Writes the
// three committed JSON Schema artifacts under
// packages/schemas/schema/*.schema.json. Run via `pnpm schema:json` from
// the repo root. json-schema.test.ts's drift check regenerates in-memory
// via toJsonSchemaArtifacts() and compares against these committed files
// byte-for-byte — it does not re-run this script, but uses the identical
// serialization (JSON.stringify(value, null, 2) + "\n") so the comparison
// is meaningful.

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toJsonSchemaArtifacts } from "../src/json-schema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.resolve(__dirname, "..", "schema");

const FILE_NAMES: Record<string, string> = {
  assessment: "assessment.schema.json",
  assessmentLine: "assessment-line.schema.json",
  expenseLine: "expense-line.schema.json",
};

function main(): void {
  mkdirSync(SCHEMA_DIR, { recursive: true });
  const artifacts = toJsonSchemaArtifacts() as Record<string, unknown>;
  for (const [key, fileName] of Object.entries(FILE_NAMES)) {
    const filePath = path.join(SCHEMA_DIR, fileName);
    writeFileSync(filePath, JSON.stringify(artifacts[key], null, 2) + "\n", "utf8");
    console.log(`wrote ${path.relative(process.cwd(), filePath)}`);
  }
}

main();
