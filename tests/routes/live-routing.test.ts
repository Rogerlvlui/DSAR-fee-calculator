// tests/routes/live-routing.test.ts
//
// Regression tests for two bugs phase-goal verification found via a live
// dev-server walkthrough that no existing test in this phase could catch,
// because every existing route test drives Route Handlers directly with a
// hand-built params object — bypassing Next's real router and its real URL
// encoding/decoding entirely (WINDOWS.md ledger entries 7 and 8):
//
//   1. Every internal link used the (hr)/(legal) route-group folder names
//      as URL prefixes (/hr/matters/new, /legal/assessments). Next.js
//      route groups never contribute a URL segment, so every one of those
//      links was dead — nothing beyond the static landing page was
//      reachable in a real browser. FIXED in 06-04: (hr)/(legal) are now
//      real hr/legal path segments, so those links are genuinely reachable
//      — see the "hr/legal are real, reachable path segments" describe
//      block below, which replaces this file's former "no dead route-group
//      links" block (that block's entire premise — that a /hr/.../legal/...
//      link is necessarily dead — is now false).
//   2. Assessment and assessment-line ids are colon-joined
//      (packages/engine's deriveAssessmentId/deriveAssessmentLineId).
//      Next's [id] dynamic segment arrives percent-encoded rather than
//      auto-decoded under this app's Turbopack dev setup, so every route
//      keyed by one of these ids 404s (surfaced as a 500) on a real
//      request.
//
// Half one (LIVE-ROUTING: hr/legal are real, reachable path segments) is a
// source scan plus a direct filesystem check — the same technique
// tests/boundary/dom-denylist.test.ts's canary half uses: it cannot
// silently pass by finding nothing, because it also asserts a minimum
// number of source files were scanned AND that the old route-group
// directories are genuinely gone from disk, not merely unreferenced.
//
// Half two (LIVE-ROUTING: colon-bearing ids decode correctly) proves the
// fix by doing exactly what every other route test in this phase
// deliberately does NOT do: passing a real, colon-bearing id through
// `encodeURIComponent` before handing it to the route as `params`,
// simulating what Next's actual dynamic-segment matching delivers.
// Untouched by 06-04 — an unrelated, still-valid concern.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import { POST as dispositionRoute } from "../../apps/web/app/api/assessment-lines/[id]/disposition/route.ts";
import { POST as bulkAcceptRoute } from "../../apps/web/app/api/assessments/[id]/bulk-accept/route.ts";
import { POST as signoffRoute } from "../../apps/web/app/api/assessments/[id]/signoff/route.ts";
import { DEMO_ROLE_COOKIE } from "../../apps/web/src/server/data/auth.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const APP_ROOT = path.join(ROOT, "apps", "web", "app");
const SRC_ROOT = path.join(ROOT, "apps", "web", "src");
const MATTERS_URL = "http://localhost/api/matters";
const LEGAL_COOKIE = `${DEMO_ROLE_COOKIE}=LEGAL_REVIEWER`;

function jsonRequest(url: string, method: string, body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new Request(url, { method, headers, body: JSON.stringify(body) });
}

function findSourceFiles(dir: string, extensions: string[]): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...findSourceFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith(".test.tsx") && !entry.name.endsWith(".test.ts")) {
      found.push(full);
    }
  }
  return found;
}

describe("LIVE-ROUTING: hr/legal are real, reachable path segments", () => {
  it("LIVE-ROUTING: the old (hr)/(legal) route-group directories no longer exist on disk", () => {
    expect(existsSync(path.join(APP_ROOT, "(hr)"))).toBe(false);
    expect(existsSync(path.join(APP_ROOT, "(legal)"))).toBe(false);
  });

  it("LIVE-ROUTING: at least one source file links to a /hr/ or /legal/ prefixed path — the new prefix is actually used, not merely available", () => {
    const files = [...findSourceFiles(APP_ROOT, [".tsx", ".ts"]), ...findSourceFiles(SRC_ROOT, [".tsx", ".ts"])];
    expect(files.length).toBeGreaterThan(10);

    const usages: string[] = [];
    let scanned = 0;
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      scanned += 1;
      if (/(?:href|router\.push)\s*[({][^)]*["'`]\/(?:hr|legal)\//.test(content)) {
        usages.push(path.relative(ROOT, file));
      }
    }
    expect(scanned).toBeGreaterThan(10);
    expect(usages.length).toBeGreaterThan(0);
  });
});

describe("LIVE-ROUTING: colon-bearing ids decode correctly", () => {
  async function createSubmittedMatter(reference: string) {
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
    return (await submitResponse.json()) as {
      id: string;
      lines: { id: string; verdict: string }[];
    };
  }

  it("LIVE-ROUTING: a percent-encoded assessment id (as Next's real router delivers it) reaches bulk-accept, not a 404", async () => {
    const assessment = await createSubmittedMatter("DSAR-ROUTING-0001");
    // Simulates what Next's [id] dynamic segment actually hands the route —
    // percent-encoded, not the raw colon-bearing string every OTHER test in
    // this phase passes directly.
    const encodedId = encodeURIComponent(assessment.id);

    const response = await bulkAcceptRoute(
      jsonRequest(
        `http://localhost/api/assessments/${encodedId}/bulk-accept`,
        "POST",
        { lineIds: [], reason: "Sighted the vendor invoice separately during review and it checks out." },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: encodedId }) }
    );
    // 400 (an empty lineIds batch is refused), not 404/500 — proves the
    // assessment id resolved; this test isn't exercising bulk-accept's own
    // business rules, just that the id lookup succeeded.
    expect(response.status).toBe(400);
  });

  it("LIVE-ROUTING: a percent-encoded assessment-line id reaches disposition, not a 404", async () => {
    const assessment = await createSubmittedMatter("DSAR-ROUTING-0002");
    const line = assessment.lines.find((candidate) => candidate.verdict === "ALLOW");
    if (!line) throw new Error("fixture has no ALLOW line");
    const encodedLineId = encodeURIComponent(line.id);

    const response = await dispositionRoute(
      jsonRequest(
        `http://localhost/api/assessment-lines/${encodedLineId}/disposition`,
        "POST",
        { action: "ACCEPT", reason: "Sighted the vendor invoice separately during review and it checks out." },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: encodedLineId }) }
    );
    expect(response.status).toBe(200);
  });

  it("LIVE-ROUTING: a percent-encoded assessment id reaches signoff (refused for a real reason, not a 404) — proves the id resolved", async () => {
    const assessment = await createSubmittedMatter("DSAR-ROUTING-0003");
    const encodedId = encodeURIComponent(assessment.id);

    const response = await signoffRoute(
      jsonRequest(
        `http://localhost/api/assessments/${encodedId}/signoff`,
        "POST",
        { qualification: "Advocate & Solicitor, Singapore", acknowledgedFlags: [], attestation: true },
        LEGAL_COOKIE
      ),
      { params: Promise.resolve({ id: encodedId }) }
    );
    // Refused (409 — the fixture's lines were never dispositioned, so the
    // still-PENDING precondition fires) rather than 404 — proves the lookup
    // found the real assessment by its decoded id, not that sign-off itself
    // succeeds.
    expect(response.status).toBe(409);
  });
});
