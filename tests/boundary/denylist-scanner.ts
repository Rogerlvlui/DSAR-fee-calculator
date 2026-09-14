// tests/boundary/denylist-scanner.ts
//
// RED STUB (TDD Task 3, 01-03-PLAN.md): deliberately incomplete so the
// behavior tests in denylist-scanner.test.ts fail on real assertions, not
// on a missing module. GREEN phase replaces this with the real
// normalize-and-match implementation.

export function normalizeFieldName(name: string): string {
  // WRONG on purpose: no NFKC normalization, no lowercasing, no stripping.
  return name;
}

export function findDenyListViolations(
  _names: string[]
): { name: string; matched: string }[] {
  // WRONG on purpose: never reports anything.
  return [];
}
