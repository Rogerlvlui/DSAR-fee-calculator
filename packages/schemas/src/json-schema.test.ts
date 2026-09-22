// packages/schemas/src/json-schema.test.ts
//
// SCHEMA-05: z.toJSONSchema() generation succeeds over the frozen entity
// schemas (including the branded Minor fields and the discriminated Cap
// union nested inside AssessmentLine via appliedCap), every money property
// types as `integer` (never `number` — the exact loosening a Phase 8 LLM
// consumer could otherwise exploit to emit a fractional amount), and the
// freshly regenerated output is byte-identical to the committed artifact
// under packages/schemas/schema/ — so a frozen type cannot change without
// the artifact changing in the same commit.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toJsonSchemaArtifacts } from "./json-schema.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = path.resolve(__dirname, "..", "schema");

// AC-07a's money suffix, applied here to JSON Schema property names rather
// than TS identifiers — the same closed set, a different surface.
const MONEY_KEY = /(amount|total|rate|fee|cap)$/i;

// Recursively collects the JSON-Schema `type` of every property whose key
// matches the money suffix AND whose value is itself a scalar number/
// integer node. A money-suffixed key pointing at a non-numeric node (e.g.
// `appliedCap`, which holds an object/union, not a number) is deliberately
// skipped — only numeric money fields are asserted on.
function collectMoneyPropertyTypes(schema: unknown, out: string[] = []): string[] {
  if (schema === null || typeof schema !== "object") return out;
  const node = schema as Record<string, unknown>;

  const properties = node.properties;
  if (properties && typeof properties === "object") {
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const propType = (value as Record<string, unknown>).type;
        if (MONEY_KEY.test(key) && (propType === "number" || propType === "integer")) {
          out.push(propType);
        }
        collectMoneyPropertyTypes(value, out);
      }
    }
  }
  if (node.$defs && typeof node.$defs === "object") {
    for (const value of Object.values(node.$defs as Record<string, unknown>)) {
      collectMoneyPropertyTypes(value, out);
    }
  }
  if (node.items) collectMoneyPropertyTypes(node.items, out);
  if (Array.isArray(node.anyOf)) for (const v of node.anyOf) collectMoneyPropertyTypes(v, out);
  if (Array.isArray(node.oneOf)) for (const v of node.oneOf) collectMoneyPropertyTypes(v, out);
  return out;
}

describe("toJsonSchemaArtifacts", () => {
  it("generates all three schemas without throwing, including branded Minor fields and the discriminated Cap union", () => {
    let artifacts: ReturnType<typeof toJsonSchemaArtifacts> | undefined;
    expect(() => {
      artifacts = toJsonSchemaArtifacts();
    }).not.toThrow();
    expect(artifacts).toBeDefined();
  });

  it("every money property in the generated Assessment schema types as integer, never number", () => {
    const { assessment } = toJsonSchemaArtifacts();
    const types = collectMoneyPropertyTypes(assessment);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(type).toBe("integer");
    }
  });

  it("every money property in the generated AssessmentLine schema types as integer, never number", () => {
    const { assessmentLine } = toJsonSchemaArtifacts();
    const types = collectMoneyPropertyTypes(assessmentLine);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(type).toBe("integer");
    }
  });

  it("every money property in the generated ExpenseLine schema types as integer, never number", () => {
    const { expenseLine } = toJsonSchemaArtifacts();
    const types = collectMoneyPropertyTypes(expenseLine);
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(type).toBe("integer");
    }
  });

  it("regenerated output is byte-identical to the committed artifact (frozen-type drift check)", () => {
    const artifacts = toJsonSchemaArtifacts();
    const freshAssessment = JSON.stringify(artifacts.assessment, null, 2) + "\n";
    const freshAssessmentLine = JSON.stringify(artifacts.assessmentLine, null, 2) + "\n";
    const freshExpenseLine = JSON.stringify(artifacts.expenseLine, null, 2) + "\n";

    expect(freshAssessment).toBe(
      readFileSync(path.join(SCHEMA_DIR, "assessment.schema.json"), "utf8")
    );
    expect(freshAssessmentLine).toBe(
      readFileSync(path.join(SCHEMA_DIR, "assessment-line.schema.json"), "utf8")
    );
    expect(freshExpenseLine).toBe(
      readFileSync(path.join(SCHEMA_DIR, "expense-line.schema.json"), "utf8")
    );
  });
});
