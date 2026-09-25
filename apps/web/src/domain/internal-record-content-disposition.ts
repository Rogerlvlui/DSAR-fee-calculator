// apps/web/src/domain/internal-record-content-disposition.ts
//
// Extracted from apps/web/app/api/assessments/[id]/internal-record/route.ts
// (260922-jr4, Rule 3 blocking-issue fix). A Next.js route.ts file may only
// export the framework's own recognised members (HTTP method handlers,
// `dynamic`, `revalidate`, etc.) — `next build`'s generated route-type
// validation rejects any other named export with a type error, which blocks
// the production build regardless of bundler. This helper was exported
// alongside GET purely so tests/routes/internal-record.test.ts could call it
// directly (07-REVIEW.md CR-01); moving it to this pure, no-I/O domain
// module keeps that direct-call test coverage while making route.ts's
// export surface framework-compliant again.
//
// CR-01 (07-REVIEW.md) — `matter.reference` is HR-controlled free text with
// no length limit and no character restriction (packages/schemas/src/matter.ts),
// so it must never be interpolated unescaped into an HTTP header value. A
// `"` in `reference` would otherwise break out of the quoted `filename`
// parameter and let a lower-privileged HR_PREPARER append arbitrary
// Content-Disposition parameters (e.g. `filename*`) that a LEGAL_REVIEWER's
// browser honors when saving this evidentiary PDF. Follows RFC 6266's own
// pattern: a plain-ASCII fallback `filename` (every non-alphanumeric,
// non-`.`/`_`/`-` character replaced, so no quote/semicolon/control
// character can ever reach the header raw) plus a percent-encoded
// `filename*=UTF-8''...` carrying the real reference for browsers that
// support it (`encodeURIComponent` — the runtime's `Headers` implementation
// already rejects literal CR/LF, so this only needs to neutralize the
// quote-breakout, not re-guard against header-splitting).
export function buildInternalRecordContentDisposition(reference: string): string {
  const asciiFallback = reference.replace(/[^A-Za-z0-9._-]/g, "_");
  const encodedReference = encodeURIComponent(reference);
  return (
    `attachment; filename="${asciiFallback}-internal-record.pdf"; ` +
    `filename*=UTF-8''${encodedReference}-internal-record.pdf`
  );
}
