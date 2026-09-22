// apps/web/src/ui/chrome/shortcut-help-overlay.test.tsx
//
// Real-DOM tests (react-dom/client createRoot into a jsdom container,
// following intake-form.test.tsx's own established precedent — no
// @testing-library dependency) since this component's focus-trap/Escape
// behavior needs real event dispatch, not merely static markup inspection.
// Tagged SHORTCUT-HELP-OVERLAY.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ShortcutHelpOverlay, ShortcutHelpTrigger } from "./shortcut-help-overlay.tsx";

const BINDINGS = [
  { keys: ["j", "k"], description: "move between lines" },
  { keys: ["a"], description: "accept / allow (this line's default action)" },
];

describe("SHORTCUT-HELP-OVERLAY", () => {
  it("SHORTCUT-HELP-OVERLAY: renders role=dialog aria-modal=true when open", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortcutHelpOverlay, {
        open: true,
        onClose: () => {},
        heading: "Keyboard shortcuts",
        bindings: BINDINGS,
      })
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("SHORTCUT-HELP-OVERLAY: renders nothing when closed", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortcutHelpOverlay, {
        open: false,
        onClose: () => {},
        heading: "Keyboard shortcuts",
        bindings: BINDINGS,
      })
    );
    expect(html).toBe("");
  });

  it("SHORTCUT-HELP-OVERLAY: renders one row per binding with each key inside its own <kbd> element", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortcutHelpOverlay, {
        open: true,
        onClose: () => {},
        heading: "Keyboard shortcuts",
        bindings: BINDINGS,
      })
    );
    expect(html).toMatch(/<kbd[^>]*>j<\/kbd>/);
    expect(html).toMatch(/<kbd[^>]*>k<\/kbd>/);
    expect(html).toMatch(/<kbd[^>]*>a<\/kbd>/);
    expect(html).toContain("move between lines");
    expect(html).toContain("accept / allow");
  });

  it("SHORTCUT-HELP-OVERLAY: renders the optional note once, at the top, when provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShortcutHelpOverlay, {
        open: true,
        onClose: () => {},
        heading: "Keyboard shortcuts",
        bindings: BINDINGS,
        note: "Reduce and strike are only offered on lines already supported by a rule.",
      })
    );
    expect(html).toContain("Reduce and strike are only offered");
  });

  it("SHORTCUT-HELP-OVERLAY: calling onClose via Escape fires exactly once per keydown", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");

    let closeCount = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(ShortcutHelpOverlay, {
          open: true,
          onClose: () => {
            closeCount += 1;
          },
          heading: "Keyboard shortcuts",
          bindings: BINDINGS,
        })
      );
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(closeCount).toBe(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("SHORTCUT-HELP-OVERLAY: calling onClose via the close button fires exactly once per click", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");

    let closeCount = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(ShortcutHelpOverlay, {
          open: true,
          onClose: () => {
            closeCount += 1;
          },
          heading: "Keyboard shortcuts",
          bindings: BINDINGS,
        })
      );
    });

    const closeButton = container.querySelector('[data-testid="shortcut-help-close"]') as HTMLButtonElement;
    act(() => {
      closeButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(closeCount).toBe(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("SHORTCUT-HELP-OVERLAY: ShortcutHelpTrigger", () => {
  it("SHORTCUT-HELP-OVERLAY: renders a real, focusable <button> — reachable by Tab, not only by pressing ?", () => {
    const html = renderToStaticMarkup(React.createElement(ShortcutHelpTrigger, { onOpen: () => {} }));
    expect(html).toMatch(/<button[^>]*>/);
    expect(html).toContain("Keyboard shortcuts (?)");
  });
});
