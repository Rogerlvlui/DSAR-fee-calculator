// tests/fixtures/denylist-canary.fixture.tsx
//
// BOUND-02 / T-1-PII-VACUOUS: a deliberately deny-listed rendered input.
// Lives under tests/fixtures/, never under apps/web/, so a real route glob
// never picks it up — this proves the DOM scanner fires, independent of
// whether any real form exists yet (01-RESEARCH.md Common Pitfalls #7).
//
// The `name` is spelled with full-width Latin characters
// ("ｎｒｉｃ" — fullwidth n-r-i-c), so this fixture also
// exercises the NFKC-normalization path: it normalizes to the ASCII
// deny-list token "nric" only if normalizeFieldName runs Unicode NFKC
// normalization before stripping non-alphanumerics.

export function DenylistCanaryFixture() {
  return (
    <form>
      <input type="text" name="ｎｒｉｃ" />
    </form>
  );
}
