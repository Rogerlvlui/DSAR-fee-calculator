// Deliberately-violating (and deliberately-clean) fixture proving the AC-07a
// money-branding ESLint rule fires on bare `number` for money-named
// identifiers, and stays silent on look-alike identifiers whose suffix does
// not actually match. Lives under tests/fixtures/, not packages/engine/ or
// packages/schemas/, so a real `pnpm eslint packages/engine packages/schemas`
// run never sees it — it is only ever linted through a path remap inside
// tests/toolchain/lint-money-brand.test.ts.

// --- Positive cases: five money-named bare `number` declarations, each of
// which must be reported. ---

type LineFields = {
  unitRate: number;
  claimedAmount: number;
  aggregateCap: number;
};

const flaggedTotal: number = 0;

function computeSurcharge(hourlyRate: number): number {
  return hourlyRate;
}

// --- Negative controls: suffix anchors at end-of-identifier, so these three
// must NOT be reported despite superficially resembling a money suffix. ---

type Controls = {
  rateLimit: number;
  capacity: number;
  feedback: number;
};
