// tests/routes/admin-audit-trail-page.test.ts
//
// Page-level integration test for apps/web/app/admin/audit/page.tsx,
// tagged ADMIN-AUDIT-TRAIL — deliberately distinct from the pre-existing
// tests/routes/audit-trail.test.ts's own AUDIT-TRAIL tag, which covers
// Phase 4's audit-event provenance, not this screen. Follows
// tests/routes/legal-queue.test.ts's exact technique: next/headers mocked
// (the page's own getCurrentActor() calls cookies(), which throws outside
// a real request scope), the page module loaded via a runtime-computed
// dynamic import (tests/tsconfig.json's include list deliberately excludes
// page.tsx files), and the rendered async server component's output
// asserted via renderToStaticMarkup.
//
// Seeds one real matter through the real create/add-line/submit route
// handlers (mirroring tests/routes/audit-export.test.ts's own seeding), so
// the matter-events table renders genuine data, not a hand-built fixture.

import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";

let mockRole = "LEGAL_REVIEWER";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === DEMO_ROLE_COOKIE ? { value: mockRole } : undefined) }),
}));

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const PAGE_PATH = path.join(ROOT, "apps", "web", "app", "admin", "audit", "page.tsx");
const { default: AdminAuditPage } = (await import(pathToFileURL(PAGE_PATH).href)) as {
  default: () => Promise<ReactElement>;
};

const BASE_URL = "http://localhost/api/matters";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validMatterInput(reference: string) {
  return {
    reference,
    jurisdictionCode: "SG",
    legalEntity: "Acme Pte Ltd",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: "2026-09-01",
    requestorClass: "FORMER_EMPLOYEE",
    currency: "SGD",
    identityVerified: true,
    identityVerifiedNote: null,
    scopeClarified: true,
    isRepeatRequestWithin12Months: false,
    isKnownDisputeOrLitigation: false,
  };
}

async function seedSubmittedMatter(reference: string): Promise<{ id: string; reference: string }> {
  const createResponse = await createMatterRoute(jsonRequest(BASE_URL, validMatterInput(reference)));
  const matter = (await createResponse.json()) as { id: string };

  const lineResponse = await addLineRoute(
    jsonRequest(`${BASE_URL}/${matter.id}/lines`, {
      categoryCode: "STAFF_TIME_SEARCH",
      description: "Staff time locating and retrieving the requested records",
      quantity: 2,
      unit: "HOUR",
      unitRate: 4000,
      incurredByGrade: "EXECUTIVE",
      isThirdPartyInvoiced: false,
      vendorName: null,
      evidenceRef: null,
      hrNote: null,
    }),
    { params: Promise.resolve({ id: matter.id }) }
  );
  if (lineResponse.status !== 201) throw new Error("expected the demo line to be added");

  const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
    params: Promise.resolve({ id: matter.id }),
  });
  if (submitResponse.status !== 200) throw new Error("expected the demo submission to succeed");

  return { id: matter.id, reference };
}

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await AdminAuditPage());
}

describe("ADMIN-AUDIT-TRAIL: /admin/audit", () => {
  it("ADMIN-AUDIT-TRAIL: a LEGAL_REVIEWER render shows the seeded matter's reference, both table sub-headings, and no raw JSON payload (combined Legal/DPO identity, 2026-09-23)", async () => {
    mockRole = "LEGAL_REVIEWER";
    const seeded = await seedSubmittedMatter("DSAR-ADMIN-AUDIT-0001");

    const html = await renderPage();

    expect(html).toContain(seeded.reference);
    expect(html).toContain("Matter events");
    expect(html).toContain("Pack lifecycle events");
    expect(html).not.toContain('{"');
  });

  it("ADMIN-AUDIT-TRAIL: an HR_PREPARER render shows the restricted message, zero <table> elements, and no seeded matter reference", async () => {
    mockRole = "HR_PREPARER";
    const seeded = await seedSubmittedMatter("DSAR-ADMIN-AUDIT-0002");

    const html = await renderPage();

    expect(html).toContain("This screen is restricted to the DPO / audit role.");
    expect(html).not.toContain("<table");
    expect(html).not.toContain(seeded.reference);
  });
});
