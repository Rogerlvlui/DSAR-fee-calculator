// Deliberately-violating fixture proving the packages/engine determinism-ban
// ESLint rules (T-2-07: no-restricted-globals on Date/Intl/crypto,
// no-restricted-properties on Math.random, no-restricted-syntax on
// toLocale* member calls) fire on each banned construct, and stay silent on
// look-alike negative controls. Lives under tests/fixtures/, outside the
// packages/engine/**/*.ts glob these rules are scoped to, so a real
// `pnpm run lint` run never sees it — it is only ever linted through a
// virtual-path remap inside tests/toolchain/lint-engine-determinism.test.ts.
//
// RED-phase stub (#3770 evidence): the positive cases and the money-brand
// regression case are intentionally not yet present here.

import { performance } from "node:perf_hooks";

// --- Negative controls: must produce zero reports despite resembling a
// banned construct. ---

const highResRead = performance.now();
const roundedDown = Math.floor(1.9);
const requestedDate = "2026-09-15";
