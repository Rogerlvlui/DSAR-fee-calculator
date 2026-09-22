// apps/web/src/ui/capability/capability-statement.test.tsx
//
// Rendered with renderToStaticMarkup for the markup assertions (the same
// technique apps/web/src/ui/chrome/status-strip.test.tsx already uses in
// this repo); the exported confirmation predicate is called directly for
// the three enabling-rule cases. Every test name is tagged CAPABILITY.

import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CapabilityStatement,
  isConfirmationPhraseConfirmed,
  CAPABILITY_STATEMENT_VERSION,
  CAPABILITY_ACK_STORAGE_KEY,
} from "./capability-statement.tsx";

function renderStatement(): string {
  return renderToStaticMarkup(
    React.createElement(CapabilityStatement, { children: React.createElement("main", null, "gated content") })
  );
}

describe("CAPABILITY: CapabilityStatement markup", () => {
  it("CAPABILITY: renders exactly six bullets, each with its bolded lead phrase intact", () => {
    const html = renderStatement();

    const bulletCount = (html.match(/<li/g) ?? []).length;
    expect(bulletCount).toBe(6);

    expect(html).toContain("<b>not know the law</b>");
    expect(html).toContain("<b>not decide anything</b>");
    expect(html).toContain("<b>cannot see your matter</b>");
    expect(html).toContain("<b>refuse to decide</b>");
    expect(html).toContain("No AI language model drafts any part of this build");
  });

  it("CAPABILITY: renders the sixth bullet's no-persistent-data sentence verbatim, in the same list-item structure", () => {
    const html = renderStatement();

    expect(html).toContain("<b>holds no persistent data</b>");
    expect(html).toContain(
      "Matters and assessments exist only in this server process&#x27;s memory and are lost on restart or code change."
    );
  });

  it("CAPABILITY: renders the closing why-layered paragraph explaining why a one-time click-through is not the only disclosure", () => {
    const html = renderStatement();

    expect(html).toContain(
      "A one-time click-through is read once and never again, so it is not the only disclosure."
    );
  });
});

describe("CAPABILITY: isConfirmationPhraseConfirmed", () => {
  it("CAPABILITY: the continue control is disabled when the input is empty", () => {
    expect(isConfirmationPhraseConfirmed("")).toBe(false);
  });

  it("CAPABILITY: the continue control is enabled when the input holds the confirmation phrase, case- and whitespace-insensitively", () => {
    expect(isConfirmationPhraseConfirmed("  I UNDERSTAND  ")).toBe(true);
  });

  it("CAPABILITY: the continue control is disabled when the input holds any other text", () => {
    expect(isConfirmationPhraseConfirmed("i agree")).toBe(false);
  });
});

describe("CAPABILITY: CAPABILITY_STATEMENT_VERSION and re-show behavior", () => {
  it("CAPABILITY: CAPABILITY_STATEMENT_VERSION is exported and is a positive integer", () => {
    expect(Number.isInteger(CAPABILITY_STATEMENT_VERSION)).toBe(true);
    expect(CAPABILITY_STATEMENT_VERSION).toBeGreaterThan(0);
  });

  it("CAPABILITY: acknowledging stores the string form of CAPABILITY_STATEMENT_VERSION, not the literal 'true'", async () => {
    window.localStorage.clear();
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        React.createElement(CapabilityStatement, { children: React.createElement("main", null, "gated content") })
      );
    });
    const input = container.querySelector("input") as HTMLInputElement;
    const button = container.querySelector("button") as HTMLButtonElement;
    act(() => {
      input.dispatchEvent(new Event("focus"));
    });
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    act(() => {
      nativeInputValueSetter?.call(input, "I understand");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(window.localStorage.getItem(CAPABILITY_ACK_STORAGE_KEY)).toBe(String(CAPABILITY_STATEMENT_VERSION));
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("CAPABILITY: a stored value equal to CAPABILITY_STATEMENT_VERSION renders children directly on mount", async () => {
    window.localStorage.setItem(CAPABILITY_ACK_STORAGE_KEY, String(CAPABILITY_STATEMENT_VERSION));
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CapabilityStatement, {
          children: React.createElement("main", { "data-testid": "child-marker" }, "gated content"),
        })
      );
    });
    expect(container.querySelector('[data-testid="child-marker"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="capability-statement"]')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("CAPABILITY: a stored value strictly less than CAPABILITY_STATEMENT_VERSION re-shows the statement", async () => {
    window.localStorage.setItem(CAPABILITY_ACK_STORAGE_KEY, String(CAPABILITY_STATEMENT_VERSION - 1 || 0));
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CapabilityStatement, {
          children: React.createElement("main", { "data-testid": "child-marker" }, "gated content"),
        })
      );
    });
    expect(container.querySelector('[data-testid="capability-statement"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="child-marker"]')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("CAPABILITY: Phase 3.1's legacy literal 'true' value is treated exactly like never-acknowledged", async () => {
    window.localStorage.setItem(CAPABILITY_ACK_STORAGE_KEY, "true");
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CapabilityStatement, {
          children: React.createElement("main", { "data-testid": "child-marker" }, "gated content"),
        })
      );
    });
    expect(container.querySelector('[data-testid="capability-statement"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="child-marker"]')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("CAPABILITY: no stored value at all also renders the statement (the existing zero-state)", async () => {
    window.localStorage.removeItem(CAPABILITY_ACK_STORAGE_KEY);
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        React.createElement(CapabilityStatement, {
          children: React.createElement("main", { "data-testid": "child-marker" }, "gated content"),
        })
      );
    });
    expect(container.querySelector('[data-testid="capability-statement"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="child-marker"]')).toBeNull();
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
