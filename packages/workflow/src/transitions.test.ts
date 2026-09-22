// packages/workflow/src/transitions.test.ts
//
// The completeness test (04-02-PLAN.md Task 1): diffs the declared
// TRANSITIONS array against a hand-transcribed copy of PRD §5's guard
// table, as one whole-array comparison, so a reordering, an addition or a
// deletion all fail visibly rather than passing quietly (T-04-08).
//
// Tagged GUARD-TABLE, same tag as evaluate-transition.test.ts's per-row
// behavior tests, so both can be run together with one -t filter.

import { describe, expect, it } from "vitest";
import { TRANSITIONS } from "./transitions.ts";
import { MATTER_STATUSES } from "@dsar/schemas/matter-status";

describe("GUARD-TABLE — TRANSITIONS completeness", () => {
  it("GUARD-TABLE: matches PRD §5's guard table transcribed by hand, in the table's own order", () => {
    // Transcribed directly from docs/PRD-dsar-fee-agent.md §5's transition
    // table, top to bottom. The table's ninth row names two origins
    // (SIGNED_OFF, CLOSED), so this list has ten entries.
    const expected: Array<[string, string, string]> = [
      ["DRAFT", "SUBMIT", "COMPUTING"],
      ["COMPUTING", "COMPUTE_SUCCEEDED", "LEGAL_REVIEW"],
      ["COMPUTING", "COMPUTE_FAILED", "DRAFT"],
      ["LEGAL_REVIEW", "RAISE_QUERY", "INFO_REQUEST"],
      ["INFO_REQUEST", "RESUBMIT", "COMPUTING"],
      ["LEGAL_REVIEW", "RECOMPUTE", "COMPUTING"],
      ["LEGAL_REVIEW", "SIGN_OFF", "SIGNED_OFF"],
      ["SIGNED_OFF", "MARK_SENT", "CLOSED"],
      ["SIGNED_OFF", "SUPERSEDE", "SUPERSEDED"],
      ["CLOSED", "SUPERSEDE", "SUPERSEDED"],
    ];

    const actual = TRANSITIONS.map((spec) => [spec.from, spec.event, spec.to]);

    expect(actual).toEqual(expected);
  });

  it("GUARD-TABLE: the two supersede rows are adjacent, immediately following each other", () => {
    const supersedeIndices = TRANSITIONS.reduce<number[]>((acc, spec, index) => {
      if (spec.event === "SUPERSEDE") acc.push(index);
      return acc;
    }, []);
    expect(supersedeIndices).toHaveLength(2);
    expect(supersedeIndices[1]).toBe((supersedeIndices[0] ?? 0) + 1);
  });

  it("GUARD-TABLE: every status the table gives an outgoing row appears as an origin, and SUPERSEDED — the sole status the table gives no outgoing row — appears as no row's origin", () => {
    // PRD §5's guard table gives CLOSED its own outgoing row (the
    // SIGNED_OFF-or-CLOSED -> SUPERSEDED correction row), so CLOSED is an
    // origin here even though the §5 diagram draws it inside the same
    // terminal box as SUPERSEDED. SUPERSEDED is the only status with no
    // outgoing row in the table — a future row added for SUPERSEDED would
    // have to edit this assertion deliberately.
    const origins = new Set(TRANSITIONS.map((spec) => spec.from));
    const expectedOrigins = new Set([
      "DRAFT",
      "COMPUTING",
      "LEGAL_REVIEW",
      "INFO_REQUEST",
      "SIGNED_OFF",
      "CLOSED",
    ]);
    expect(origins).toEqual(expectedOrigins);

    const nonOrigins = MATTER_STATUSES.filter((status) => !origins.has(status));
    expect(nonOrigins).toEqual(["SUPERSEDED"]);
  });
});
