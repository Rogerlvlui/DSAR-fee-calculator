// apps/web/src/domain/keyboard-shortcuts.test.ts
//
// Pure key->intent mapping tests (REVIEW-08/NAV-03). Tagged keyboard-shortcuts.

import { describe, expect, it } from "vitest";
import { mapReviewKey, mapQueueKey } from "./keyboard-shortcuts.ts";

describe("keyboard-shortcuts: mapReviewKey", () => {
  it("keyboard-shortcuts: j/k/a/r/s/?/Escape each map to their own distinct intent", () => {
    expect(mapReviewKey("j")).toBe("MOVE_NEXT");
    expect(mapReviewKey("k")).toBe("MOVE_PREV");
    expect(mapReviewKey("a")).toBe("ACCEPT");
    expect(mapReviewKey("r")).toBe("REDUCE");
    expect(mapReviewKey("s")).toBe("STRIKE");
    expect(mapReviewKey("?")).toBe("HELP");
    expect(mapReviewKey("Escape")).toBe("CLOSE_HELP");
  });

  it("keyboard-shortcuts: every mapped intent is distinct from every other", () => {
    const intents = ["j", "k", "a", "r", "s", "?", "Escape"].map((key) => mapReviewKey(key));
    expect(new Set(intents).size).toBe(intents.length);
  });

  it("keyboard-shortcuts: any other key maps to null", () => {
    expect(mapReviewKey("x")).toBeNull();
    expect(mapReviewKey("Enter")).toBeNull();
  });

  it("keyboard-shortcuts: is case-sensitive — 'J' (Shift+j) does not map, a deliberate choice", () => {
    expect(mapReviewKey("J")).toBeNull();
    expect(mapReviewKey("K")).toBeNull();
  });
});

describe("keyboard-shortcuts: mapQueueKey", () => {
  it("keyboard-shortcuts: j/k/Enter/? each map to their own distinct intent", () => {
    expect(mapQueueKey("j")).toBe("MOVE_NEXT");
    expect(mapQueueKey("k")).toBe("MOVE_PREV");
    expect(mapQueueKey("Enter")).toBe("OPEN");
    expect(mapQueueKey("?")).toBe("HELP");
  });

  it("keyboard-shortcuts: any other key maps to null", () => {
    expect(mapQueueKey("x")).toBeNull();
    expect(mapQueueKey("a")).toBeNull();
  });

  it("keyboard-shortcuts: is case-sensitive — 'J' does not map", () => {
    expect(mapQueueKey("J")).toBeNull();
  });

  it("keyboard-shortcuts: Escape maps to CLOSE_HELP for the queue too", () => {
    expect(mapQueueKey("Escape")).toBe("CLOSE_HELP");
  });
});
