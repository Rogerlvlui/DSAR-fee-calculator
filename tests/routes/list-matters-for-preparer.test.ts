// tests/routes/list-matters-for-preparer.test.ts
//
// listMattersForPreparer's own role-check and ownership-filter proof.
// Mirrors assessments-list.test.ts's own precedent (a data-layer-function
// integration test under tests/routes/, exercised as a plain function call
// since there is no HTTP route handler here). The single seeded
// HR_PREPARER identity cannot itself prove the ownership filter
// discriminates (05-RESEARCH.md Common Pitfall 6), so this file constructs
// a second, distinct DemoActor inline.

import { describe, expect, it } from "vitest";
import { UserRefSchema, RoleSchema } from "@dsar/schemas/primitives";
import { createMatter, listMattersForPreparer } from "../../apps/web/src/server/data/matters.ts";
import { DEMO_USERS, type DemoActor } from "../../apps/web/src/server/data/auth.ts";
import { REFERENCE_MATTER_INPUT } from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";
import { newUlid } from "../../apps/web/src/server/ids.ts";

function resetStore(): void {
  demoStore.matters.clear();
  demoStore.expenseLines.clear();
  demoStore.assessments.clear();
}

// A second, distinct HR_PREPARER-role actor — never the seeded
// DEMO_USERS.HR_PREPARER — so a test can prove the filter actually
// discriminates between two different preparers, not merely that it
// returns everything the one seeded identity ever creates.
const OTHER_PREPARER: DemoActor = {
  user: UserRefSchema.parse({
    id: newUlid(),
    displayName: "Other Preparer — HR Shared Services",
    email: "other.preparer@example.invalid",
  }),
  role: RoleSchema.parse("HR_PREPARER"),
};

describe("list-matters-for-preparer: listMattersForPreparer", () => {
  it("list-matters-for-preparer: refuses a non-HR_PREPARER actor", async () => {
    resetStore();
    await expect(listMattersForPreparer(DEMO_USERS.LEGAL_REVIEWER)).rejects.toThrow(/HR_PREPARER role/);
  });

  it("list-matters-for-preparer: given two matters created by two distinct actors, returns only the calling actor's own matter", async () => {
    resetStore();
    await createMatter(DEMO_USERS.HR_PREPARER, { ...REFERENCE_MATTER_INPUT, reference: "DSAR-PREPARER-A" });
    await createMatter(OTHER_PREPARER, { ...REFERENCE_MATTER_INPUT, reference: "DSAR-PREPARER-B" });

    const ownMatters = await listMattersForPreparer(DEMO_USERS.HR_PREPARER);
    expect(ownMatters).toHaveLength(1);
    expect(ownMatters[0]?.reference).toBe("DSAR-PREPARER-A");

    const otherMatters = await listMattersForPreparer(OTHER_PREPARER);
    expect(otherMatters).toHaveLength(1);
    expect(otherMatters[0]?.reference).toBe("DSAR-PREPARER-B");
  });

  it("list-matters-for-preparer: returns an empty list when the actor has created no matters", async () => {
    resetStore();
    const matters = await listMattersForPreparer(DEMO_USERS.HR_PREPARER);
    expect(matters).toEqual([]);
  });
});
