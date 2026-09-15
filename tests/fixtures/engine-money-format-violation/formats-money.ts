// Deliberately-violating fixture proving the dependency-cruiser
// no-money-formatting-in-engine rule fires. Lives outside packages/engine,
// mirroring tests/fixtures/engine-io-violation/impure.ts, so a real
// `depcruise packages/engine packages/schemas` run stays clean — it is
// only ever scanned through a temporary rule override inside
// tests/toolchain/purity-gate.test.ts.
import { formatMinor } from "../../../packages/schemas/src/money.ts";
import { toMinor } from "../../../packages/schemas/src/primitives.ts";

export const displayAmount = (value: number): string => formatMinor(toMinor(value), "SGD");
