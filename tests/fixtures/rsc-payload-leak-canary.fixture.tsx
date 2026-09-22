// tests/fixtures/rsc-payload-leak-canary.fixture.tsx
//
// ACCESS-07 / T-06-05: a deliberately-violating "use client" component whose
// Props interface names a whole privileged object (`Assessment`) rather
// than narrow scalar fields. Lives under tests/fixtures/, never under
// apps/web/, so it is reachable only from tests/boundary/rsc-payload-leak.test.ts
// — never imported by real app code (matching
// denylist-canary.fixture.tsx's own established isolation). Exists solely
// to prove the scanner in that test file actually fires; a scanner that
// never catches anything here is a scanner that never catches anything for
// real, either (the same T-1-PII-VACUOUS reasoning that fixture's own
// header comment names).

"use client";

import type { Assessment } from "@dsar/schemas/assessment";

export interface CanaryLeakyComponentProps {
  assessment: Assessment;
}

export function CanaryLeakyComponent({ assessment }: CanaryLeakyComponentProps) {
  return <div>{assessment.id}</div>;
}
