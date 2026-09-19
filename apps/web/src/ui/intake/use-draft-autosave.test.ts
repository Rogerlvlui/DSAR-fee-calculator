// apps/web/src/ui/intake/use-draft-autosave.test.ts
//
// writeDraftToStorage's two pure-function tests run with no `act`, no
// timers and no component tree. The timer-driven hook tests mount a real
// component tree via react-dom/client's createRoot inside `act` (both
// ship with react/react-dom already) under vi.useFakeTimers(), and spy on
// window.localStorage.setItem to count/inspect writes and to simulate a
// failing write for the error-state test.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { writeDraftToStorage, useDraftAutosave, type AutosaveState } from "./use-draft-autosave.ts";

describe("use-draft-autosave: writeDraftToStorage", () => {
  it("use-draft-autosave: against a real (jsdom) localStorage, returns true and stores the JSON-serialised value", () => {
    const result = writeDraftToStorage("test-key", { a: 1 });
    expect(result).toBe(true);
    expect(window.localStorage.getItem("test-key")).toBe(JSON.stringify({ a: 1 }));
  });

  it("use-draft-autosave: against a hand-built storage object whose setItem throws, returns false without throwing itself", () => {
    const failingStorage: Pick<Storage, "setItem"> = {
      setItem: () => {
        throw new Error("storage full");
      },
    };
    expect(() => writeDraftToStorage("test-key", { a: 1 }, failingStorage)).not.toThrow();
    expect(writeDraftToStorage("test-key", { a: 1 }, failingStorage)).toBe(false);
  });
});

describe("use-draft-autosave: useDraftAutosave", () => {
  let container: HTMLElement;
  let root: Root;
  let latestState: AutosaveState | null = null;
  let currentValue = { draft: "v1" };

  function TestComponent({ value }: { value: unknown }) {
    latestState = useDraftAutosave("autosave-test-key", value, 10_000);
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    latestState = null;
    currentValue = { draft: "v1" };
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(React.createElement(TestComponent, { value: currentValue }));
    });
  });

  afterEach(() => {
    act(() => {
      try {
        root.unmount();
      } catch {
        // Already unmounted by the test itself (the unmount-clears-interval
        // case) — calling unmount() a second time is a no-op for cleanup
        // purposes here, never a real double-unmount bug.
      }
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("use-draft-autosave: before any time advances, reports status idle and writes nothing to storage yet", () => {
    expect(latestState).toEqual({ status: "idle", savedAt: null });
    expect(window.localStorage.getItem("autosave-test-key")).toBeNull();
  });

  it("use-draft-autosave: advancing fake timers by 10 seconds causes exactly one write carrying the current value, status becomes saved with a non-null savedAt", async () => {
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("autosave-test-key")).toBe(JSON.stringify(currentValue));
    expect(latestState?.status).toBe("saved");
    expect(latestState?.savedAt).not.toBeNull();
  });

  it("use-draft-autosave: advancing a further 10 seconds with a CHANGED value writes the NEW value, not the one captured at mount", async () => {
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    const changedValue = { draft: "v2-changed" };
    act(() => {
      root.render(React.createElement(TestComponent, { value: changedValue }));
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.localStorage.getItem("autosave-test-key")).toBe(JSON.stringify(changedValue));
  });

  it("use-draft-autosave: when the underlying storage write throws, status becomes error rather than saved, and no exception escapes", async () => {
    vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestState?.status).toBe("error");
  });

  it("use-draft-autosave: unmounting before the next tick clears the interval — no further write occurs", async () => {
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, "setItem");

    act(() => {
      root.unmount();
    });

    await act(async () => {
      vi.advanceTimersByTime(20_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
