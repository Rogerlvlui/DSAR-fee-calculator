// tests/routes/hr-matters-list.test.ts
//
// Page-level integration test for apps/web/app/hr/matters/page.tsx.
// Creates matters via the existing createMatter/addExpenseLine data-layer
// functions with two distinct jurisdictions — one whose pack yields an
// advisory deadline (SG, responseDeadlineDays: 30) and one that does not
// (VN, both deadline fields null) — then renders the page's default export
// directly (an async function; awaited, then renderToStaticMarkup'd,
// matching tests/boundary/dom-denylist.test.ts's tolerant-render
// technique) and asserts on the rendered HTML.
//
// next/headers is mocked: the page's own getCurrentActor() calls
// next/headers' cookies(), which throws "called outside a request scope"
// under a plain function call with no real Next.js request context. The
// mock's empty cookie jar resolves to the same HR_PREPARER default
// resolveActorFromCookieHeader(null) already returns.
//
// The page module is loaded via a runtime-computed dynamic import (path
// built at runtime, not a string literal) rather than a static import
// statement — tests/tsconfig.json's "include" list deliberately excludes
// page.tsx files and apps/web/src/server/current-actor.ts (its "next/headers"
// import does not resolve under this project's inherited "nodenext"
// resolution the way it does under apps/web/tsconfig.json's "bundler"
// resolution; see that tsconfig's own note). A static import would need
// both listed and would still fail to typecheck; a runtime-computed
// import() expression is invisible to tsc's project file-list check,
// matching tests/boundary/dom-denylist.test.ts's own glob-half technique.

import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMatter, listMattersForPreparer } from "../../apps/web/src/server/data/matters.ts";
import { DEMO_USERS } from "../../apps/web/src/server/data/auth.ts";
import { REFERENCE_MATTER_INPUT } from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { demoStore } from "../../apps/web/src/server/repositories/memory/store.ts";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const PAGE_PATH = path.join(ROOT, "apps", "web", "app", "hr", "matters", "page.tsx");
const { default: HrMattersListPage } = (await import(pathToFileURL(PAGE_PATH).href)) as {
  default: () => Promise<ReactElement>;
};

function resetStore(): void {
  demoStore.matters.clear();
  demoStore.expenseLines.clear();
  demoStore.assessments.clear();
}

describe("hr-matters-list: /hr/matters", () => {
  it("hr-matters-list: with zero matters, renders the verbatim empty-state sentence and a link back to /hr/matters/new", async () => {
    resetStore();
    const html = renderToStaticMarkup(await HrMattersListPage());
    expect(html).toContain('data-testid="matters-empty"');
    expect(html).toContain("No matters yet.");
    expect(html).toContain('href="/hr/matters/new"');
  });

  it("hr-matters-list: with one matter whose jurisdiction yields an advisory deadline, renders its reference, collapsed status label, and an Advisory-labelled container", async () => {
    resetStore();
    await createMatter(DEMO_USERS.HR_PREPARER, {
      ...REFERENCE_MATTER_INPUT,
      reference: "DSAR-LIST-SG-0001",
      jurisdictionCode: "SG",
      currency: "SGD",
    });

    const html = renderToStaticMarkup(await HrMattersListPage());
    expect(html).toContain("DSAR-LIST-SG-0001");
    expect(html).toContain("Draft");
    expect(html).toContain('data-testid="advisory-deadline"');
    expect(html).toContain("Advisory");
  });

  it("hr-matters-list: a matter whose jurisdiction pack yields no advisory deadline (both fields null) renders no advisory-deadline container", async () => {
    resetStore();
    await createMatter(DEMO_USERS.HR_PREPARER, {
      ...REFERENCE_MATTER_INPUT,
      reference: "DSAR-LIST-VN-0001",
      jurisdictionCode: "VN",
      currency: "VND",
    });

    const html = renderToStaticMarkup(await HrMattersListPage());
    expect(html).toContain("DSAR-LIST-VN-0001");
    expect(html).not.toContain('data-testid="advisory-deadline"');
  });

  it("hr-matters-list: each row links to /hr/matters/{id}, the existing HR result/status page", async () => {
    resetStore();
    const matter = await createMatter(DEMO_USERS.HR_PREPARER, {
      ...REFERENCE_MATTER_INPUT,
      reference: "DSAR-LIST-LINK-0001",
    });
    const [own] = await listMattersForPreparer(DEMO_USERS.HR_PREPARER);
    expect(own?.id).toBe(matter.id);

    const html = renderToStaticMarkup(await HrMattersListPage());
    expect(html).toContain(`href="/hr/matters/${matter.id}"`);
  });
});
