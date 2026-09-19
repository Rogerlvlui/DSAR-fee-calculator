// apps/web/src/domain/hr-matter-status-label.test.ts
//
// Tagged with this module's own subject name. Each in-flight status gets
// its own assertion (not a combined check) so a future status added to the
// closed set without updating the map fails loudly rather than silently
// falling through.

import { describe, expect, it } from "vitest";
import { matterStatusLabelForHr } from "./hr-matter-status-label.ts";

describe("hr-matter-status-label: matterStatusLabelForHr", () => {
  it("hr-matter-status-label: DRAFT returns 'Draft'", () => {
    expect(matterStatusLabelForHr("DRAFT")).toBe("Draft");
  });

  it("hr-matter-status-label: COMPUTING returns 'Sent to Legal'", () => {
    expect(matterStatusLabelForHr("COMPUTING")).toBe("Sent to Legal");
  });

  it("hr-matter-status-label: LEGAL_REVIEW returns 'Sent to Legal'", () => {
    expect(matterStatusLabelForHr("LEGAL_REVIEW")).toBe("Sent to Legal");
  });

  it("hr-matter-status-label: INFO_REQUEST returns 'Sent to Legal'", () => {
    expect(matterStatusLabelForHr("INFO_REQUEST")).toBe("Sent to Legal");
  });

  it("hr-matter-status-label: SIGNED_OFF and CLOSED both return 'Assessed'", () => {
    expect(matterStatusLabelForHr("SIGNED_OFF")).toBe("Assessed");
    expect(matterStatusLabelForHr("CLOSED")).toBe("Assessed");
  });

  it("hr-matter-status-label: is exhaustive over MatterStatus's full seven-value closed set", () => {
    // Compile-time exhaustiveness is the real guarantee (no `default`
    // branch in the implementation); this runtime check covers all seven
    // literal values so a mistranscribed map entry still fails a test.
    const allStatuses = ["DRAFT", "COMPUTING", "LEGAL_REVIEW", "INFO_REQUEST", "SIGNED_OFF", "CLOSED", "SUPERSEDED"] as const;
    for (const status of allStatuses) {
      expect(typeof matterStatusLabelForHr(status)).toBe("string");
    }
  });
});
