// apps/web/src/ui/queue/queue-keyboard-scope.test.tsx
//
// Real-DOM tests (react-dom/client createRoot into a jsdom container),
// mirroring review-keyboard-scope.test.tsx's own established technique.
// Tagged queue-keyboard-scope.

import { describe, expect, it } from "vitest";
import React from "react";
import { QueueKeyboardScope } from "./queue-keyboard-scope.tsx";

function FixtureRow({ id }: { id: string }) {
  return (
    <a href={`/legal/assessments/${id}`} data-row-id={id}>
      {id}
    </a>
  );
}

async function renderScope(rowIds: string[]) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        QueueKeyboardScope,
        { rowIds },
        React.createElement("div", null, ...rowIds.map((id) => React.createElement(FixtureRow, { key: id, id })))
      )
    );
  });

  return { container, root, act };
}

function dispatchKey(key: string, target: EventTarget = document): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function cleanup(container: HTMLElement, root: { unmount: () => void }, act: (fn: () => void) => void): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("queue-keyboard-scope", () => {
  it("queue-keyboard-scope: j/k move DOM focus between row anchors, clamped at both ends", async () => {
    const { container, root, act } = await renderScope(["row-1", "row-2", "row-3"]);

    act(() => dispatchKey("j"));
    expect(document.activeElement?.getAttribute("data-row-id")).toBe("row-1");
    act(() => dispatchKey("j"));
    expect(document.activeElement?.getAttribute("data-row-id")).toBe("row-2");
    act(() => dispatchKey("k"));
    expect(document.activeElement?.getAttribute("data-row-id")).toBe("row-1");
    act(() => dispatchKey("k"));
    expect(document.activeElement?.getAttribute("data-row-id")).toBe("row-1"); // clamped

    cleanup(container, root, act);
  });

  it("queue-keyboard-scope: movement clamps past the last row — no throw", async () => {
    const { container, root, act } = await renderScope(["row-1", "row-2"]);

    act(() => dispatchKey("j"));
    act(() => dispatchKey("j"));
    act(() => dispatchKey("j"));
    expect(document.activeElement?.getAttribute("data-row-id")).toBe("row-2");

    cleanup(container, root, act);
  });

  it("queue-keyboard-scope: ? opens the SAME ShortcutHelpOverlay with the queue's own three bindings and no no-op note", async () => {
    const { container, root, act } = await renderScope(["row-1"]);

    act(() => dispatchKey("?"));
    expect(container.querySelector('[data-testid="shortcut-help-overlay"]')).not.toBeNull();
    expect(container.textContent).toContain("move between claims");
    expect(container.textContent).toContain("open the focused claim");
    expect(container.textContent).not.toContain("Reduce and strike are only offered");

    act(() => dispatchKey("Escape"));
    expect(container.querySelector('[data-testid="shortcut-help-overlay"]')).toBeNull();

    cleanup(container, root, act);
  });

  it("queue-keyboard-scope: a keydown while focus is inside an interactive element other than a row anchor is ignored", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(
          QueueKeyboardScope,
          { rowIds: ["row-1", "row-2"] },
          React.createElement(
            "div",
            null,
            React.createElement("input", { "data-testid": "defensive-input" }),
            React.createElement(FixtureRow, { id: "row-1" }),
            React.createElement(FixtureRow, { id: "row-2" })
          )
        )
      );
    });

    const input = container.querySelector('[data-testid="defensive-input"]') as HTMLInputElement;
    input.focus();
    act(() => dispatchKey("j", input));
    expect(document.activeElement).toBe(input);

    act(() => root.unmount());
    container.remove();
  });

  it("queue-keyboard-scope: native Enter-on-a-focused-anchor is never intercepted — no custom OPEN dispatch exists", async () => {
    const { container, root, act } = await renderScope(["row-1"]);
    act(() => dispatchKey("j"));
    const anchor = document.activeElement as HTMLAnchorElement;
    expect(anchor.tagName).toBe("A");
    // Dispatching Enter must not throw and must not be intercepted by this
    // scope — the browser's own native anchor-activation behavior handles
    // it, which this test cannot simulate in jsdom, but it can prove no
    // custom handler throws or blocks the event.
    expect(() => act(() => dispatchKey("Enter", anchor))).not.toThrow();

    cleanup(container, root, act);
  });
});
