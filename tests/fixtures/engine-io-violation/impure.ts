// Deliberately-violating fixture proving the dependency-cruiser purity gate
// fires. Lives under tests/fixtures/, not packages/engine/, so a real
// `depcruise packages/engine` run stays clean — it is only ever scanned
// through a temporary rule override inside tests/toolchain/purity-gate.test.ts.
import { readFileSync } from "node:fs";

export const impureRead = (path: string): string => readFileSync(path, "utf-8");
