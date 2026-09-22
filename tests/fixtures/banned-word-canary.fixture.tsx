// tests/fixtures/banned-word-canary.fixture.tsx
//
// DISC-03 / T-05-13: a deliberate control fixture proving the banned-word
// scanner in tests/boundary/ui-banned-words.test.ts actually inspects
// something real. Mirrors tests/fixtures/denylist-canary.fixture.tsx's own
// shape: lives under tests/fixtures/, never under apps/web/, so a real page
// glob never picks it up.
//
// One sentence deliberately uses two of AC-32's banned words ("compliant",
// "lawful"); a second, unrelated sentence correctly capitalises "Legal" as
// the department's proper noun — proving the case-sensitive matcher both
// catches a real violation and does not over-catch a legitimate usage.

export function BannedWordCanaryFixture() {
  return (
    <div>
      <p>This assessment is fully compliant and the fee is lawful.</p>
      <p>Ask Legal for a second opinion.</p>
    </div>
  );
}
