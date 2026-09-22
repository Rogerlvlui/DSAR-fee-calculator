// tests/routes/assessments-list.test.ts
//
// Regression test for 03.1-REVIEW.md's CR-01 and its follow-up security
// finding UNREG-1: before CR-01 there was no working path from HR intake to
// legal review at all — the landing page's "Open an assessment, as Legal"
// link pointed at a URL with no route behind it. The first fix added a
// worklist page, but it read the memory repositories directly with no role
// check anywhere (the sole exception to this phase's otherwise-universal
// "requireRole() first" pattern). This tests the role-checked DAL function
// the page now calls, `listReviewableMatters`, the same way every other
// route in this phase is tested — the page component itself calls
// next/headers' cookies(), which (like every other page.tsx in this phase)
// needs a real Next.js request context and is not rendered directly in
// tests; see apps/web/app/(legal)/assessments/page.tsx's own note.

import { describe, expect, it } from "vitest";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { listReviewableMatters } from "../../apps/web/src/server/data/matters.ts";
import { DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";

const MATTERS_URL = "http://localhost/api/matters";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function createSubmittedMatter(reference: string): Promise<{ matterId: string; assessmentId: string }> {
  const matterResponse = await createMatterRoute(
    jsonRequest(MATTERS_URL, "POST", { ...REFERENCE_MATTER_INPUT, reference })
  );
  expect(matterResponse.status).toBe(201);
  const matter = (await matterResponse.json()) as { id: string };

  for (const lineInput of REFERENCE_FIXTURE_LINE_INPUTS) {
    const lineResponse = await addLineRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/lines`, "POST", lineInput), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${MATTERS_URL}/${matter.id}/submit`, "POST", {}), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  const assessment = (await submitResponse.json()) as { id: string };
  return { matterId: matter.id, assessmentId: assessment.id };
}

function resetStore(): void {
  demoStore.matters.clear();
  demoStore.expenseLines.clear();
  demoStore.assessments.clear();
}

describe("ASSESSMENTS-LIST", () => {
  it("ASSESSMENTS-LIST: refuses an HR-role actor — UNREG-1's fix, the role check the first cut of this page skipped entirely", async () => {
    resetStore();
    await expect(listReviewableMatters(DEMO_USERS.HR_PREPARER)).rejects.toThrow(/LEGAL_REVIEWER role/);
  });

  it("ASSESSMENTS-LIST: returns an empty worklist when no matter exists", async () => {
    resetStore();
    const entries = await listReviewableMatters(DEMO_USERS.LEGAL_REVIEWER);
    expect(entries).toEqual([]);
  });

  it("ASSESSMENTS-LIST: after a matter is submitted, the worklist names its real assessment id — the CR-01 path from HR intake to legal review", async () => {
    resetStore();
    const { matterId, assessmentId } = await createSubmittedMatter("DSAR-LIST-0001");

    const entries = await listReviewableMatters(DEMO_USERS.LEGAL_REVIEWER);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.assessmentId).toBe(assessmentId);
    expect(entries[0]?.matter.id).toBe(matterId);
    expect(entries[0]?.matter.reference).toBe("DSAR-LIST-0001");
    expect(entries[0]?.matter.status).toBe("LEGAL_REVIEW");
  });

  it("ASSESSMENTS-LIST: a matter not yet submitted (still DRAFT) does not appear in the worklist", async () => {
    resetStore();
    await createMatterRoute(jsonRequest(MATTERS_URL, "POST", { ...REFERENCE_MATTER_INPUT, reference: "DSAR-LIST-0002" }));

    const entries = await listReviewableMatters(DEMO_USERS.LEGAL_REVIEWER);
    expect(entries).toEqual([]);
  });

  it("listReviewableMatters: 06-06 widening — also includes a matter in INFO_REQUEST and a matter in CLOSED, still excludes DRAFT/COMPUTING", async () => {
    resetStore();
    const { matterId: legalReviewMatterId } = await createSubmittedMatter("DSAR-LIST-0003");
    const infoRequestMatter = await memoryMatterRepository.getMatter(legalReviewMatterId);
    if (!infoRequestMatter) throw new Error("fixture matter not found");
    await memoryMatterRepository.updateMatter({ ...infoRequestMatter, status: "INFO_REQUEST" });

    const { matterId: closedMatterId } = await createSubmittedMatter("DSAR-LIST-0004");
    const closedMatter = await memoryMatterRepository.getMatter(closedMatterId);
    if (!closedMatter) throw new Error("fixture matter not found");
    await memoryMatterRepository.updateMatter({ ...closedMatter, status: "CLOSED" });

    await createMatterRoute(jsonRequest(MATTERS_URL, "POST", { ...REFERENCE_MATTER_INPUT, reference: "DSAR-LIST-0005" }));

    const entries = await listReviewableMatters(DEMO_USERS.LEGAL_REVIEWER);
    const statuses = entries.map((entry) => entry.matter.status).sort();
    expect(statuses).toEqual(["CLOSED", "INFO_REQUEST"]);
  });
});
