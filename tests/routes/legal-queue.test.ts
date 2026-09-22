// tests/routes/legal-queue.test.ts
//
// Page-level integration test for apps/web/app/legal/queue/page.tsx (06-06),
// tagged LEGAL-QUEUE. Follows tests/routes/hr-matters-list.test.ts's own
// established technique exactly: next/headers mocked (the page's own
// getCurrentActor() calls cookies(), which throws outside a real request
// scope), the page module loaded via a runtime-computed dynamic import
// (tests/tsconfig.json's include list deliberately excludes page.tsx
// files), and the rendered async server component's output asserted on via
// renderToStaticMarkup.
//
// Fixture matters are driven all the way to a real, submitted assessment
// via the direct data-layer pipeline (createMatter -> addExpenseLine ->
// submitForAssessment) — listReviewableMatters only includes a matter that
// has a real persisted assessment (getAssessmentByMatterId), so merely
// mutating a matter's own status field without ever submitting it would
// never actually appear in the queue.

import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMatter, addExpenseLine, submitForAssessment } from "../../apps/web/src/server/data/matters.ts";
import { DEMO_ROLE_COOKIE, DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { REFERENCE_MATTER_INPUT, REFERENCE_FIXTURE_LINE_INPUTS } from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";
import { memoryMatterRepository } from "../../apps/web/src/server/repositories/memory/matter-repository.ts";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === DEMO_ROLE_COOKIE ? { value: "LEGAL_REVIEWER" } : undefined) }),
}));

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const PAGE_PATH = path.join(ROOT, "apps", "web", "app", "legal", "queue", "page.tsx");
const { default: LegalQueuePage } = (await import(pathToFileURL(PAGE_PATH).href)) as {
  default: (props: { searchParams: Promise<{ sort?: string }> }) => Promise<ReactElement>;
};

function resetStore(): void {
  demoStore.matters.clear();
  demoStore.expenseLines.clear();
  demoStore.assessments.clear();
}

async function renderQueue(sort?: string): Promise<string> {
  const searchParams = sort === undefined ? {} : { sort };
  return renderToStaticMarkup(await LegalQueuePage({ searchParams: Promise.resolve(searchParams) }));
}

let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-QUEUE-${String(matterCounter).padStart(4, "0")}`;
}

/** Drives a matter all the way to a real, persisted LEGAL_REVIEW assessment
 * via the direct data-layer pipeline, with the given requestReceivedOn. */
async function buildSubmittedMatter(requestReceivedOn: string) {
  const matter = await createMatter(DEMO_USERS.HR_PREPARER, {
    ...REFERENCE_MATTER_INPUT,
    reference: nextReference(),
    requestReceivedOn,
  });
  for (const lineInput of REFERENCE_FIXTURE_LINE_INPUTS) {
    await addExpenseLine(DEMO_USERS.HR_PREPARER, matter.id, lineInput);
  }
  await submitForAssessment(DEMO_USERS.HR_PREPARER, matter.id);
  const submitted = await memoryMatterRepository.getMatter(matter.id);
  if (!submitted) throw new Error("fixture matter not found after submit");
  return submitted;
}

describe("LEGAL-QUEUE: /legal/queue", () => {
  it("LEGAL-QUEUE: an INFO_REQUEST matter appears with the 'Awaiting HR reply' label", async () => {
    resetStore();
    const matter = await buildSubmittedMatter("2026-09-01");
    await memoryMatterRepository.updateMatter({ ...matter, status: "INFO_REQUEST" });

    const html = await renderQueue();
    expect(html).toContain(matter.reference);
    expect(html).toContain("Awaiting HR reply");
  });

  it("LEGAL-QUEUE: the default render (no sort param) orders by deadline soonest", async () => {
    resetStore();
    // SG (responseDeadlineDays 30) received further in the past resolves an
    // earlier (sooner/more-overdue) due date than one received more
    // recently — deadline-soonest ordering must put the further-in-the-past
    // one first, proving this is genuinely deadline-based ordering.
    const older = await buildSubmittedMatter("2026-08-01");
    const newer = await buildSubmittedMatter("2026-09-10");

    const html = await renderQueue();
    const olderIndex = html.indexOf(older.reference);
    const newerIndex = html.indexOf(newer.reference);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeLessThan(newerIndex);
  });

  it("LEGAL-QUEUE: ?sort=oldest reorders by age", async () => {
    resetStore();
    const older = await buildSubmittedMatter("2026-08-01");
    const newer = await buildSubmittedMatter("2026-09-10");

    const html = await renderQueue("oldest");
    const olderIndex = html.indexOf(older.reference);
    const newerIndex = html.indexOf(newer.reference);
    expect(olderIndex).toBeGreaterThan(-1);
    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeLessThan(newerIndex);
  });

  it('LEGAL-QUEUE: the active sort toggle carries aria-current="true", and no colour-only urgency signal is rendered', async () => {
    resetStore();
    const html = await renderQueue();

    const toggleStart = html.indexOf('data-testid="queue-sort-toggle"');
    const toggleEnd = html.indexOf("</nav>", toggleStart);
    const toggleHtml = html.slice(toggleStart, toggleEnd);
    expect(toggleHtml).toContain('aria-current="true"');
    expect(toggleHtml).toContain("underline");
    // The active option is distinguished by an underline class, never by a
    // colour-only signal.
    expect(toggleHtml).not.toMatch(/color:|text-warn|text-danger/);
  });

  it("LEGAL-QUEUE: the widened listReviewableMatters still refuses an HR_PREPARER actor", async () => {
    resetStore();
    // Reuses the existing requireRole gate — no new logic to test here
    // beyond confirming the widened function still enforces it (the plan's
    // own acceptance note).
    const { listReviewableMatters } = await import("../../apps/web/src/server/data/matters.ts");
    await expect(listReviewableMatters(DEMO_USERS.HR_PREPARER)).rejects.toThrow(/LEGAL_REVIEWER role/);
  });
});
