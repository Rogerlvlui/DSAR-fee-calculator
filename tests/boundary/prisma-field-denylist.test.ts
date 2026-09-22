// tests/boundary/prisma-field-denylist.test.ts
//
// AC-06 half one (BOUND-02, T-1-PII): every field name in prisma/schema.prisma
// checked against PERSONAL_DATA_DENY_LIST.
//
// Reads the schema off disk and parses it with `getDMMF` from
// `@prisma/internals` — NOT the generated client's runtime `Prisma.dmmf`.
// Prisma 7's default Rust-free `prisma-client` generator returns a
// "drastically simplified" DMMF at runtime that is missing per-field
// metadata (01-RESEARCH.md Common Pitfalls #1); reading the schema source
// directly sidesteps this entirely.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import prismaInternals from "@prisma/internals";
import { findDenyListViolations } from "./denylist-scanner.ts";

const { getDMMF } = prismaInternals;

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const SCHEMA_PATH = path.join(ROOT, "prisma", "schema.prisma");

describe("Prisma field deny-list (BOUND-02, T-1-PII)", () => {
  it("parses at least one model from schema.prisma (non-vacuous parse)", async () => {
    const datamodel = readFileSync(SCHEMA_PATH, "utf-8");
    const dmmf = await getDMMF({ datamodel });
    expect(dmmf.datamodel.models.length).toBeGreaterThan(0);
  });

  it("reports zero deny-list violations across every Prisma field name", async () => {
    const datamodel = readFileSync(SCHEMA_PATH, "utf-8");
    const dmmf = await getDMMF({ datamodel });

    const fieldNames = dmmf.datamodel.models.flatMap((model) =>
      model.fields.map((field) => field.name)
    );

    const violations = findDenyListViolations(fieldNames);
    expect(violations).toEqual([]);
  });
});
