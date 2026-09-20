// packages/schemas/src/constants.test.ts
//
// Tagged REASON-STOP-LIST — AC-23's literal 11-item stop-list, transcribed
// verbatim from the PRD (line 910), exported exactly once.

import { describe, expect, it } from "vitest";
import { REASON_STOP_LIST } from "./constants.ts";

const PRD_LITERAL_LIST = ["ok", "okay", "fine", "agreed", "yes", "no", "n/a", "na", "noted", "as above", "same"];

describe("REASON-STOP-LIST", () => {
  it("REASON-STOP-LIST: contains exactly the 11 PRD-literal entries, case-sensitive as written", () => {
    expect(REASON_STOP_LIST).toEqual(PRD_LITERAL_LIST);
    expect(REASON_STOP_LIST.length).toBe(11);
  });
});
