// tests/routes/honesty.test.ts
//
// The server-side half of the five-honesty-properties audit (03.1-05 Task
// 2), tagged HONESTY. Runs in the node environment ("routes" project) —
// deliberately, not the jsdom "web" project — because one of its three
// assertions renders the real root layout (apps/web/app/layout.tsx), which
// transitively imports apps/web/src/server/data/auth.ts. server-only.ts's
// runtime guard throws the moment `window` exists, and jsdom always
// provides one; the node environment here has none, so the guard never
// trips. This is the same reason tests/boundary/dom-denylist.test.ts
// (03.1-01) renders page.tsx files under the "boundary" project rather than
// "web" — a real, working enforcement of the server/client boundary, not an
// accident to route around with a different render technique.
//
// The other two assertions prove the two properties that can only be
// checked from real engine output over the real HTTP path: the coercion
// function's isolation (T-03.1-31), and that every engine-derived and
// pack-authored string this demo renders is free of the pack validator's
// own banned words (T-03.1-30) — imported from the SAME matcher pack
// validation uses, per @dsar/schemas/constants's own "a second copy is a
// defect" note.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { findBannedWord } from "@dsar/rulepacks/validate";
import { POST as createMatterRoute } from "../../apps/web/app/api/matters/route.ts";
import { POST as addLineRoute } from "../../apps/web/app/api/matters/[id]/lines/route.ts";
import { POST as submitRoute } from "../../apps/web/app/api/matters/[id]/submit/route.ts";
import {
  REFERENCE_MATTER_INPUT,
  REFERENCE_FIXTURE_LINE_INPUTS,
} from "../../apps/web/src/server/__fixtures__/reference-fixture.ts";
import { coercePackForDemoEngine, resolvePinnedRulePack } from "../../apps/web/src/server/engine-invocation.ts";
import RootLayout from "../../apps/web/app/layout.tsx";

const BASE_URL = "http://localhost/api/matters";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// A different, unique matter reference per call — this file's own fixture
// drive must not collide with tests/routes/reference-fixture.test.ts's
// (both exercise the same in-memory store within one Vitest worker).
let matterCounter = 0;
function nextReference(): string {
  matterCounter += 1;
  return `DSAR-HONESTY-${String(matterCounter).padStart(4, "0")}`;
}

async function submitReferenceFixture() {
  const createResponse = await createMatterRoute(
    jsonRequest(BASE_URL, { ...REFERENCE_MATTER_INPUT, reference: nextReference() })
  );
  expect(createResponse.status).toBe(201);
  const matter = (await createResponse.json()) as { id: string };

  for (const lineInput of REFERENCE_FIXTURE_LINE_INPUTS) {
    const lineResponse = await addLineRoute(jsonRequest(`${BASE_URL}/${matter.id}/lines`, lineInput), {
      params: Promise.resolve({ id: matter.id }),
    });
    expect(lineResponse.status).toBe(201);
  }

  const submitResponse = await submitRoute(jsonRequest(`${BASE_URL}/${matter.id}/submit`, {}), {
    params: Promise.resolve({ id: matter.id }),
  });
  expect(submitResponse.status).toBe(200);
  return submitResponse.json() as Promise<{
    lines: { basis: string; flagReasons: { message: string }[] }[];
    matterLevelFlags: { message: string }[];
  }>;
}

describe("HONESTY: the demo coercion is isolated", () => {
  it("HONESTY: coercePackForDemoEngine returns a copy differing from the loaded pack in exactly one field, and the loaded pack's own status is unchanged after the call", () => {
    const loaded = resolvePinnedRulePack("SG-PDPA", "2026.09.1");
    const loadedStatusBefore = loaded.status;

    const coerced = coercePackForDemoEngine(loaded);

    // The loaded pack itself must not have been mutated by the call.
    expect(loaded.status).toBe(loadedStatusBefore);
    expect(loaded.status).toBe("DRAFT");
    expect(coerced.status).toBe("ACTIVE");

    // A deep field-by-field comparison — not a single known-field
    // assertion — proves the coercion is surgical rather than merely
    // "happens to leave everything else looking right in this fixture".
    const keys = new Set([...Object.keys(loaded), ...Object.keys(coerced)]);
    const differingKeys = [...keys].filter(
      (key) =>
        JSON.stringify((loaded as Record<string, unknown>)[key]) !==
        JSON.stringify((coerced as Record<string, unknown>)[key])
    );
    expect(differingKeys).toEqual(["status"]);
  });
});

describe("HONESTY: engine-derived and pack-authored strings carry no banned word", () => {
  it("HONESTY: every line's basis, flag reason message and matter-level flag message in the real six-line assessment is free of the pack validator's own banned words", async () => {
    const assessment = await submitReferenceFixture();

    let scannedStringCount = 0;
    for (const line of assessment.lines) {
      expect(findBannedWord(line.basis)).toBeNull();
      scannedStringCount += 1;
      for (const reason of line.flagReasons) {
        expect(findBannedWord(reason.message)).toBeNull();
        scannedStringCount += 1;
      }
    }
    for (const flag of assessment.matterLevelFlags) {
      expect(findBannedWord(flag.message)).toBeNull();
      scannedStringCount += 1;
    }

    // The reference fixture has six lines, two of them FLAG (one or more
    // flag reasons each) and at least one matter-level flag — this guards
    // against the loop above silently scanning zero strings and the test
    // passing for the wrong reason.
    expect(scannedStringCount).toBeGreaterThan(6);
  });
});

describe("HONESTY: the permanent marker's position", () => {
  it("HONESTY: the root layout mounts the permanent no-persistent-data marker outside (before) the children slot, so a page that forgot to include it would still be covered", () => {
    const html = renderToStaticMarkup(
      React.createElement(RootLayout, {
        children: React.createElement("main", { "data-testid": "layout-children-probe" }, "probe content"),
      })
    );

    const bannerIndex = html.indexOf('data-testid="demo-banner"');
    const childrenIndex = html.indexOf('data-testid="layout-children-probe"');

    expect(bannerIndex).toBeGreaterThan(-1);
    expect(childrenIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeLessThan(childrenIndex);
  });
});
