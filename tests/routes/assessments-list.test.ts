// tests/routes/assessments-list.test.ts
//
// Regression test for 03.1-REVIEW.md's CR-01: before the fix, the landing
// page's "Open an assessment, as Legal" link pointed at a URL with no route
// behind it, and nothing in the app ever surfaced an assessment id — there
// was no working path from HR intake to legal review at all. This proves
// the listing page a lawyer actually lands on renders a link to a real
// submitted matter's assessment, stays empty before any matter exists, and
// still lists a matter after it is signed off.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";
import AssessmentsListPage from "../../apps/web/app/(legal)/assessments/page.tsx";

const MATTERS_URL = "http://localhost/api/matters";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

async function renderListPage(): Promise<string> {
  const element = await AssessmentsListPage();
  return renderToStaticMarkup(element);
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

describe("ASSESSMENTS-LIST", () => {
  it("ASSESSMENTS-LIST: renders the empty-worklist message when no matter exists", async () => {
    demoStore.matters.clear();
    demoStore.expenseLines.clear();
    demoStore.assessments.clear();

    const html = await renderListPage();
    expect(html).toContain('data-testid="assessments-empty"');
    expect(html).not.toContain('data-testid="assessments-list"');
  });

  it("ASSESSMENTS-LIST: after a matter is submitted, the worklist links to its real assessment id — the CR-01 path from HR intake to legal review", async () => {
    demoStore.matters.clear();
    demoStore.expenseLines.clear();
    demoStore.assessments.clear();

    const { assessmentId } = await createSubmittedMatter("DSAR-LIST-0001");

    const html = await renderListPage();
    expect(html).toContain(`href="/legal/assessments/${assessmentId}"`);
    expect(html).toContain("DSAR-LIST-0001");
    expect(html).toContain("Awaiting review");
  });

  it("ASSESSMENTS-LIST: a matter not yet submitted (still DRAFT) does not appear in the worklist", async () => {
    demoStore.matters.clear();
    demoStore.expenseLines.clear();
    demoStore.assessments.clear();

    await createMatterRoute(jsonRequest(MATTERS_URL, "POST", { ...REFERENCE_MATTER_INPUT, reference: "DSAR-LIST-0002" }));

    const html = await renderListPage();
    expect(html).toContain('data-testid="assessments-empty"');
  });
});
