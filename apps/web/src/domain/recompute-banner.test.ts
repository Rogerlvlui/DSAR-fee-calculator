// apps/web/src/domain/recompute-banner.test.ts
//
// Moved from apps/web/src/ui/review/recompute-confirm.test.tsx alongside the
// relocation of shouldRenderRecomputeBanner (see recompute-banner.ts's own
// header note). Tagged RECOMPUTE-BANNER.

import { describe, expect, it } from "vitest";
import { shouldRenderRecomputeBanner } from "./recompute-banner.ts";

describe("RECOMPUTE-BANNER: shouldRenderRecomputeBanner (gating, both directions)", () => {
  it("RECOMPUTE-BANNER: a genuine version mismatch shows the banner", () => {
    expect(shouldRenderRecomputeBanner("2026.09.1", "2026.10.1")).toBe(true);
  });

  it("RECOMPUTE-BANNER: identical versions (today's real case for every committed pack) show nothing", () => {
    expect(shouldRenderRecomputeBanner("2026.09.1", "2026.09.1")).toBe(false);
  });
});
