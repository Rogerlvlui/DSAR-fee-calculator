// packages/schemas/src/json-schema.ts
//
// SCHEMA-05: JSON Schema generation for the Phase 8 LLM boundary (PRD §6
// opening line: "Generate JSON Schema from these for the LLM boundary in
// §8.2"). Uses zod 4's NATIVE z.toJSONSchema() — not the `zod-to-json-schema`
// npm package, unmaintained since ~Nov 2025 (.claude/CLAUDE.md;
// 01-RESEARCH.md's "Don't Hand-Roll" table). Depending on an unmaintained
// package for the exact mechanism that constrains model output would be a
// needless liability.
//
// Generation runs over the frozen entity schemas (AssessmentSchema,
// AssessmentLineSchema, ExpenseLineSchema). The output is written to
// packages/schemas/schema/*.schema.json by the `schema:json` npm script
// (packages/schemas/scripts/generate-json-schema.ts) and committed — a
// later change to a frozen type then shows up as a reviewable diff in the
// artifact, not only as different bytes at test time (json-schema.test.ts's
// drift check).

import { z } from "zod";
import { AssessmentLineSchema, AssessmentSchema } from "./assessment.ts";
import { ExpenseLineSchema } from "./expense-line.ts";

export function toJsonSchemaArtifacts(): {
  assessment: unknown;
  assessmentLine: unknown;
  expenseLine: unknown;
} {
  return {
    assessment: z.toJSONSchema(AssessmentSchema),
    assessmentLine: z.toJSONSchema(AssessmentLineSchema),
    expenseLine: z.toJSONSchema(ExpenseLineSchema),
  };
}
