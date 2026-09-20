// apps/web/src/ui/review/review-keyboard-scope.test.tsx
//
// Real-DOM tests (react-dom/client createRoot into a jsdom container,
// following intake-form.test.tsx's own established precedent) — this
// component's j/k/a/r/s/? behavior needs real keydown dispatch and real
// focus tracking, not static markup inspection. Tagged review-keyboard-scope.
//
// Fixture cards mirror line-card.tsx's own real markup shape closely enough
// to exercise this scope's DOM-query dispatch (data-line-id, data-action
// buttons, a reduce amount input) without importing the full LineCard/
// DispositionControls stack — this file's own job is proving the SCOPE's
// dispatch logic, not re-testing disposition-controls.tsx's internals.

import { describe, expect, it } from "vitest";
import React from "react";
import { ReviewKeyboardScope } from "./review-keyboard-scope.tsx";

interface FixtureCardSpec {
  id: string;
  actions: string[]; // e.g. ["accept", "reduce", "strike"]
}

function FixtureCard({ id, actions }: FixtureCardSpec) {
  return (
    <article data-testid="line-card" data-line-id={id} tabIndex={-1}>
      {actions.map((action) => (
        <span key={action}>
          {action === "reduce" ? <input type="number" data-testid={`reduce-input-${id}`} readOnly /> : null}
          <button type="button" data-testid="disposition-action" data-action={action} onClick={() => {}}>
            {action}
          </button>
        </span>
      ))}
    </article>
  );
}

async function renderScope(cards: FixtureCardSpec[]) {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      React.createElement(
        ReviewKeyboardScope,
        { lineIds: cards.map((card) => card.id) },
        React.createElement(
          "div",
          null,
          ...cards.map((card) => React.createElement(FixtureCard, { key: card.id, ...card }))
        )
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

describe("review-keyboard-scope", () => {
  it("review-keyboard-scope: pressing j moves DOM focus to the first card, j again to the second, k moves back", async () => {
    const { container, root, act } = await renderScope([
      { id: "line-1", actions: ["accept", "reduce", "strike"] },
      { id: "line-2", actions: ["accept", "reduce", "strike"] },
    ]);

    act(() => dispatchKey("j"));
    expect(document.activeElement?.getAttribute("data-line-id")).toBe("line-1");

    act(() => dispatchKey("j"));
    expect(document.activeElement?.getAttribute("data-line-id")).toBe("line-2");

    act(() => dispatchKey("k"));
    expect(document.activeElement?.getAttribute("data-line-id")).toBe("line-1");

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: movement clamps at both ends — no wraparound, no throw", async () => {
    const { container, root, act } = await renderScope([
      { id: "line-1", actions: ["accept"] },
      { id: "line-2", actions: ["accept"] },
    ]);

    act(() => dispatchKey("k")); // before the start
    expect(document.activeElement?.getAttribute("data-line-id")).toBe("line-1");

    act(() => dispatchKey("j"));
    act(() => dispatchKey("j"));
    act(() => dispatchKey("j")); // past the end
    expect(document.activeElement?.getAttribute("data-line-id")).toBe("line-2");

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: pressing a on a card offering accept clicks that card's [data-action=accept] button", async () => {
    let accepted = false;
    const { container, root, act } = await renderScope([{ id: "line-1", actions: ["accept", "strike"] }]);
    const button = container.querySelector('[data-line-id="line-1"] [data-action="accept"]') as HTMLButtonElement;
    button.addEventListener("click", () => {
      accepted = true;
    });

    act(() => dispatchKey("j"));
    act(() => dispatchKey("a"));
    expect(accepted).toBe(true);

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: pressing a on a FLAG card (no accept action) is a silent no-op — no error thrown", async () => {
    const { container, root, act } = await renderScope([{ id: "line-1", actions: ["strike"] }]);

    act(() => dispatchKey("j"));
    expect(() => act(() => dispatchKey("a"))).not.toThrow();

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: pressing r moves DOM focus into that card's reduce amount input", async () => {
    const { container, root, act } = await renderScope([{ id: "line-1", actions: ["accept", "reduce", "strike"] }]);

    act(() => dispatchKey("j"));
    act(() => dispatchKey("r"));
    expect(document.activeElement).toBe(container.querySelector('[data-testid="reduce-input-line-1"]'));

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: pressing s clicks [data-action=strike]", async () => {
    let struck = false;
    const { container, root, act } = await renderScope([{ id: "line-1", actions: ["accept", "strike"] }]);
    const button = container.querySelector('[data-line-id="line-1"] [data-action="strike"]') as HTMLButtonElement;
    button.addEventListener("click", () => {
      struck = true;
    });

    act(() => dispatchKey("j"));
    act(() => dispatchKey("s"));
    expect(struck).toBe(true);

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: pressing ? opens the ShortcutHelpOverlay with the review-screen bindings and no-op note; Escape closes it", async () => {
    const { container, root, act } = await renderScope([{ id: "line-1", actions: ["accept"] }]);

    act(() => dispatchKey("?"));
    expect(container.querySelector('[data-testid="shortcut-help-overlay"]')).not.toBeNull();
    expect(container.textContent).toContain("Reduce and strike are only offered");

    act(() => dispatchKey("Escape"));
    expect(container.querySelector('[data-testid="shortcut-help-overlay"]')).toBeNull();

    cleanup(container, root, act);
  });

  it("review-keyboard-scope: a keydown while focus is inside a textarea/input is ignored entirely — typing 'j' must never trigger navigation", async () => {
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(
          ReviewKeyboardScope,
          { lineIds: ["line-1", "line-2"] },
          React.createElement(
            "div",
            null,
            React.createElement(FixtureCard, { id: "line-1", actions: ["accept"] }),
            React.createElement("textarea", { "data-testid": "reason-field" }),
            React.createElement(FixtureCard, { id: "line-2", actions: ["accept"] })
          )
        )
      );
    });

    const textarea = container.querySelector('[data-testid="reason-field"]') as HTMLTextAreaElement;
    textarea.focus();
    act(() => dispatchKey("j", textarea));

    expect(document.activeElement).toBe(textarea);

    act(() => root.unmount());
    container.remove();
  });
});
