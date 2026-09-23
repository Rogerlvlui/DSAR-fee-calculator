// tests/routes/matter-submitted-authorization.test.ts
//
// Regression test for 05-REVIEW-ADDENDUM.md CR-01 (independent code review
// finding): apps/web/app/(hr)/matters/[id]/submitted/page.tsx previously read
// any matter id directly off the repository with zero authorization — no
// getCurrentActor(), no requireRole() anywhere on that page. This is the
// exact bug class already found and fixed twice before in this project
// (Phase 3.1's UNREG-1, Phase 4's WR-02): every other page/data-layer
// function in this codebase resolves the actor then calls a
// requireRole()-gated function in apps/web/src/server/data/* before
// touching the repository.
//
// The fix routes the page through getHrMatterStatus(actor, id) — the same
// requireRole()-gated, NotFoundError-throwing read the sibling
// matters/[id]/page.tsx already uses (proven by hr-result.test.ts). This
// file proves that same boundary now also protects the submitted-
// confirmation page's own data dependency, following the
// data-layer-function integration test pattern list-matters-for-preparer.
// test.ts and hr-result.test.ts already establish (no HTTP route handler
// exists for a server component page, so the underlying data-layer
// function is exercised directly).
//
// Ownership scoping (per-creator, as listMattersForPreparer enforces for
// the HR worklist) is deliberately out of scope here: getHrMatterStatus has
// never scoped by creator — matters/[id]/page.tsx (05-REVIEW.md's own
// un-flagged sibling) shares the identical role-only boundary. This test
// proves the actual regression this page had: a caller could read status
// for ANY matter id, regardless of role. That gap is closed by requiring
// the HR_PREPARER role first.

import { describe, expect, it } from "vitest";
import { createMatter, getHrMatterStatus } from "../../apps/web/src/server/data/matters.ts";
import { DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { REFERENCE_MATTER_INPUT } from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";

function resetStore(): void {
  demoStore.matters.clear();
  demoStore.expenseLines.clear();
  demoStore.assessments.clear();
}

describe("MATTER-SUBMITTED-AUTH: the submitted-confirmation page's data dependency", () => {
  it("MATTER-SUBMITTED-AUTH: refuses a non-HR_PREPARER actor reading a matter's status (the exact gap CR-01 found — this page had zero authorization)", async () => {
    resetStore();
    const matter = await createMatter(DEMO_USERS.HR_PREPARER, {
      ...REFERENCE_MATTER_INPUT,
      reference: "DSAR-SUBMITTED-AUTH-0001",
    });

    await expect(getHrMatterStatus(DEMO_USERS.LEGAL_REVIEWER, matter.id)).rejects.toThrow(/HR_PREPARER role/);
  });

  it("MATTER-SUBMITTED-AUTH: an HR_PREPARER actor can read the matter's status once created", async () => {
    resetStore();
    const matter = await createMatter(DEMO_USERS.HR_PREPARER, {
      ...REFERENCE_MATTER_INPUT,
      reference: "DSAR-SUBMITTED-AUTH-0002",
    });

    const { matter: read } = await getHrMatterStatus(DEMO_USERS.HR_PREPARER, matter.id);
    expect(read.id).toBe(matter.id);
    expect(read.reference).toBe("DSAR-SUBMITTED-AUTH-0002");
  });

  it("MATTER-SUBMITTED-AUTH: refuses (NotFoundError) for a nonexistent matter id, even for the correct role — no repository read leaks a not-found distinction to an unauthorized caller either", async () => {
    resetStore();
    await expect(getHrMatterStatus(DEMO_USERS.HR_PREPARER, "nonexistent-id")).rejects.toThrow(/No matter with id/);
  });
});
