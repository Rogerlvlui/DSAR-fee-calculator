// Deliberately-violating fixture proving the packages/engine determinism-ban
// ESLint rules (T-2-07: no-restricted-globals on Date/Intl/crypto,
// no-restricted-properties on Math.random, no-restricted-syntax on
// toLocale* member calls) fire on each banned construct, and stay silent on
// look-alike negative controls. Lives under tests/fixtures/, outside the
// packages/engine/**/*.ts glob these rules are scoped to, so a real
// `pnpm run lint` run never sees it — it is only ever linted through a
// virtual-path remap inside tests/toolchain/lint-engine-determinism.test.ts.
//
import { performance } from "node:perf_hooks";

// --- Positive cases: one banned construct per line, each must be
// reported. ---

const constructedClock = new Date();
const clockRead = Date.now();
const randomDraw = Math.random();
const mintedId = crypto.randomUUID();
const localeFormatter = new Intl.DateTimeFormat("en-SG");
const localeFormatted = (1234).toLocaleString();

// --- Negative controls: must produce zero reports despite resembling a
// banned construct. ---

const highResRead = performance.now();
const roundedDown = Math.floor(1.9);
const requestedDate = "2026-09-15";

// --- Money-brand regression: proves the engine-scoped no-restricted-syntax
// entry still carries AC-07a's shared money-brand selectors (T-2-08) after
// this file's config change. ---

const flaggedTotal: number = 0;
