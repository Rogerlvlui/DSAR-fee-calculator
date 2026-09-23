// apps/web/src/ui/admin/audit-trail-view.test.tsx
//
// Component-level tests for AuditTrailView, tagged via the
// "audit-trail-view" -t filter (07.1-02-PLAN.md Tasks 1-2). Task 1 covers
// populated-data rendering (both tables, em-dash nulls, no raw JSON
// payload, no design "Hash" column); Task 2 adds the per-table empty-state
// cases (each table renders the Copywriting Contract's exact heading/body
// independently of the other).

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AuditTrailView,
  AUDIT_TRAIL_EMPTY_HEADING,
  AUDIT_TRAIL_EMPTY_BODY,
  type MatterAuditEventRow,
} from "./audit-trail-view.tsx";
import type { PackLifecycleEvent } from "@dsar/audit/interface";
import type { UserRef } from "@dsar/schemas/primitives";

const ACTOR: UserRef = {
  id: "01M2VQ03WC9DDCY458Y2YH1HNH",
  displayName: "Wei Ling Ong — Data Protection Officer",
  email: "wei.ling.ong@example.invalid",
};

function buildMatterEvent(overrides: Partial<MatterAuditEventRow> = {}): MatterAuditEventRow {
  return {
    id: "01AUDITEVENT00000000000001",
    matterId: "01MATTER000000000000000001",
    matterReference: "DSAR-TEST-0001",
    actor: ACTOR,
    actorRole: "DPO_ADMIN",
    at: "2026-09-23T00:00:00Z",
    type: "SUBMITTED",
    payload: { field: "status", before: "DRAFT", after: "COMPUTING" },
    rulePackVersion: null,
    engineVersion: null,
    ...overrides,
  };
}

function buildPackEvent(overrides: Partial<PackLifecycleEvent> = {}): PackLifecycleEvent {
  return {
    id: "01PACKEVENT0000000000000001",
    packId: "SG-PDPA",
    packVersion: "2026.09.1",
    actor: ACTOR,
    actorRole: "RULEPACK_AUTHOR",
    at: "2026-09-23T00:00:00Z",
    type: "PACK_ACTIVATED",
    payload: { field: "status", before: "DRAFT", after: "ACTIVE" },
    ...overrides,
  };
}

describe("audit-trail-view: AuditTrailView", () => {
  it("audit-trail-view: renders both tables with real data, an em dash where Pack/Engine are null, and no design Hash column", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditTrailView, {
        matterEvents: [buildMatterEvent()],
        packLifecycleEvents: [buildPackEvent()],
      })
    );

    expect(html).toContain("DSAR-TEST-0001");
    expect(html).toContain("Matter events");
    expect(html).toContain("Pack lifecycle events");
    expect(html).toContain("SG-PDPA");
    expect(html).toContain("—");
    expect(html).not.toContain("Hash");
    expect(html).not.toContain('{"');
  });

  it("audit-trail-view: renders real Pack/Engine values when present, not an em dash", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditTrailView, {
        matterEvents: [buildMatterEvent({ rulePackVersion: "2026.09.1", engineVersion: "1.4.0" })],
        packLifecycleEvents: [],
      })
    );

    expect(html).toContain("2026.09.1");
    expect(html).toContain("1.4.0");
  });

  it("audit-trail-view: an empty matterEvents array renders the exact empty-state heading and body in place of that table", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditTrailView, { matterEvents: [], packLifecycleEvents: [buildPackEvent()] })
    );

    expect(html).toContain(AUDIT_TRAIL_EMPTY_HEADING);
    expect(html).toContain(AUDIT_TRAIL_EMPTY_BODY);
    expect(html).toContain("Pack lifecycle events");
    expect(html).toContain("SG-PDPA");
  });

  it("audit-trail-view: an empty packLifecycleEvents array renders the exact empty-state heading and body, independently of a populated matter-events table", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditTrailView, { matterEvents: [buildMatterEvent()], packLifecycleEvents: [] })
    );

    expect(html).toContain("DSAR-TEST-0001");
    expect(html).toContain(AUDIT_TRAIL_EMPTY_HEADING);
    expect(html).toContain(AUDIT_TRAIL_EMPTY_BODY);
  });

  it("audit-trail-view: both arrays empty renders both empty states and the zero-count line", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuditTrailView, { matterEvents: [], packLifecycleEvents: [] })
    );

    expect(html).toContain("No audit events recorded yet.");
    expect(html.match(new RegExp(AUDIT_TRAIL_EMPTY_HEADING, "g"))?.length).toBe(2);
  });
});
