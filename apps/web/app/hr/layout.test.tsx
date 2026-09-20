// apps/web/app/hr/layout.test.tsx
//
// Proves the capability-statement gate is real at the HR route-group
// layout, not merely present. `CapabilityStatement` only renders its
// `children` after `useEffect` reads an acknowledgement from
// `localStorage`; a static, effect-free `renderToStaticMarkup` render
// always takes the unacknowledged branch, so the correct assertion is that
// the rendered output contains the gate's own markup and does NOT contain
// the child marker — proving the child is gated rather than passed
// straight through. Tagged CAPABILITY.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HrLayout from "./layout.tsx";

describe("CAPABILITY: HrLayout mounts the capability-statement gate", () => {
  it("CAPABILITY: gates children behind the capability statement rather than passing them straight through", () => {
    const html = renderToStaticMarkup(
      React.createElement(HrLayout, {
        children: React.createElement("div", { "data-testid": "child-marker" }, "child content"),
      })
    );

    expect(html).toContain('data-testid="capability-statement"');
    expect(html).not.toContain('data-testid="child-marker"');
  });
});
