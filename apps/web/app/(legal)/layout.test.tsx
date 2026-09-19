// apps/web/app/(legal)/layout.test.tsx
//
// Mirrors apps/web/app/(hr)/layout.test.tsx's own proof, for the legal
// route-group layout. Tagged CAPABILITY.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LegalLayout from "./layout.tsx";

describe("CAPABILITY: LegalLayout mounts the capability-statement gate", () => {
  it("CAPABILITY: gates children behind the capability statement rather than passing them straight through", () => {
    const html = renderToStaticMarkup(
      React.createElement(LegalLayout, {
        children: React.createElement("div", { "data-testid": "child-marker" }, "child content"),
      })
    );

    expect(html).toContain('data-testid="capability-statement"');
    expect(html).not.toContain('data-testid="child-marker"');
  });
});
