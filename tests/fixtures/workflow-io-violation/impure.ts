// Deliberately-violating fixture proving the dependency-cruiser purity
// gates fire for packages/workflow (no-io-in-workflow and
// no-infra-in-workflow). Lives under tests/fixtures/, not
// packages/workflow/, so a real `depcruise packages/workflow` run stays
// clean — it is only ever scanned through a temporary rule override inside
// tests/toolchain/purity-gate.test.ts.
import { readFileSync } from "node:fs";
import "@dsar/audit/interface";

export const impureRead = (path: string): string => readFileSync(path, "utf-8");
