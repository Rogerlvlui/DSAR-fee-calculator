// Deliberately-violating fixture proving the T-04-19 status-write ESLint
// rule also fires inside a `.tsx` file (04-REVIEW.md WR-03): the rule's
// original `files` glob was `.ts`-only, so a server component under
// apps/web/app/**/*.tsx constructing a literal MatterStatus value was
// never linted by this rule at all — not merely "linted and passing", but
// entirely unseen. Lives under tests/fixtures/, not apps/web/app/, so a
// real `pnpm eslint apps/web` run never sees it — it is only ever linted
// through the virtual-path remap in tests/toolchain/lint-status-write.test.ts
// (the same technique the companion `.ts` fixture uses).

export function DraftBadge() {
  const matter = {
    id: "matter-1",
    status: "DRAFT",
  };
  return <span>{matter.status}</span>;
}
