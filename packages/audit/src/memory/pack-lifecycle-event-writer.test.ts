// packages/audit/src/memory/pack-lifecycle-event-writer.test.ts
//
// Tagged PACK-LIFECYCLE. Proves append/list/export, monotonic order,
// deep-copy isolation on both the list and export paths, undeclared-key
// refusal, the two pack-lifecycle event types are distinguishable on read,
// the stored event carries no matter identifier at all, and — the case
// that matters most, since the whole reason this stream exists is that the
// two record shapes cannot be merged without reopening a frozen field —
// that the pack-lifecycle stream and the matter-scoped stream are
// genuinely separate: neither export leaks the other's events.

import { describe, expect, it } from "vitest";
import { memoryPackLifecycleEventWriter } from "./pack-lifecycle-event-writer.ts";
import { memoryAuditEventWriter } from "./audit-event-writer.ts";
import type { NewPackLifecycleEvent } from "../interface.ts";
import { packActivatedPayload, packEditedPayload, transitionPayload } from "../payload-builders.ts";

const BASE_PACK_EVENT: NewPackLifecycleEvent = {
  packId: "pack-sg-pdpa",
  packVersion: "2026.09.1",
  actor: {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    displayName: "Test Rulepack Author",
    email: "test-author@example.invalid",
  },
  actorRole: "RULEPACK_AUTHOR",
  at: "2026-09-19T00:00:00Z",
  type: "PACK_ACTIVATED",
  payload: packActivatedPayload("DRAFT", "ACTIVE"),
};

describe("PACK-LIFECYCLE — memoryPackLifecycleEventWriter", () => {
  it("PACK-LIFECYCLE: appending a pack-activation event returns it with a monotonic identifier and stores it", async () => {
    const packId = "pack-append-basic";
    const stored = await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId });
    expect(stored.id).toEqual(expect.any(String));

    const events = await memoryPackLifecycleEventWriter.listByPack(packId, BASE_PACK_EVENT.packVersion);
    expect(events.some((event) => event.id === stored.id)).toBe(true);
  });

  it("PACK-LIFECYCLE: listing by pack identifier and version returns only that pack version's events, in written order, and not another version's", async () => {
    const packId = "pack-listing-scope";
    const versionA = "2026.09.1";
    const versionB = "2026.09.2";

    const first = await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId, packVersion: versionA });
    const second = await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId, packVersion: versionA });
    await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId, packVersion: versionB });

    const events = await memoryPackLifecycleEventWriter.listByPack(packId, versionA);
    expect(events.map((event) => event.id)).toEqual([first.id, second.id]);
  });

  it("PACK-LIFECYCLE: exporting returns every pack-lifecycle event in written order", async () => {
    const first = await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId: "pack-export-order-a" });
    const second = await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId: "pack-export-order-b" });

    const exported = await memoryPackLifecycleEventWriter.exportAll();
    const ids = exported.map((event) => event.id);
    expect(ids).toEqual([...ids].sort());
    expect(exported.some((event) => event.id === first.id)).toBe(true);
    expect(exported.some((event) => event.id === second.id)).toBe(true);
  });

  it("PACK-LIFECYCLE: a caller mutating an event returned by listByPack leaves the stored record unchanged", async () => {
    const packId = "pack-deepcopy-list";
    const version = "v1";
    await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId, packVersion: version });

    const [reread] = await memoryPackLifecycleEventWriter.listByPack(packId, version);
    if (!reread) throw new Error("expected at least one event");
    reread.payload.after = "TAMPERED";

    const [rereadAgain] = await memoryPackLifecycleEventWriter.listByPack(packId, version);
    expect(rereadAgain?.payload.after).not.toBe("TAMPERED");
  });

  it("PACK-LIFECYCLE: a caller mutating an event returned by exportAll leaves the stored record unchanged", async () => {
    const packId = "pack-deepcopy-export";
    await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId });

    const exported = await memoryPackLifecycleEventWriter.exportAll();
    const target = exported.find((event) => event.packId === packId);
    if (!target) throw new Error("expected the just-written event to be exported");
    target.payload.after = "TAMPERED";

    const reExported = await memoryPackLifecycleEventWriter.exportAll();
    const reread = reExported.find((event) => event.packId === packId);
    expect(reread?.payload.after).not.toBe("TAMPERED");
  });

  it("PACK-LIFECYCLE: appending an event whose payload carries a key outside the declared set is refused and nothing is stored", async () => {
    const packId = "pack-undeclared-key";
    const version = "v1";
    const badEvent = {
      ...BASE_PACK_EVENT,
      packId,
      packVersion: version,
      payload: { field: "status", before: "DRAFT", after: "ACTIVE", notDeclared: "oops" },
    } as unknown as NewPackLifecycleEvent;

    await expect(memoryPackLifecycleEventWriter.append(badEvent)).rejects.toThrow();

    // Scoped to this pack/version, which for a pack that has had nothing
    // else written to it is equivalent to asserting its export is empty —
    // the store itself is a shared singleton across every test in this
    // file, so a literal exportAll() would already reflect earlier tests'
    // unrelated events (same reasoning as 04-01's AUDIT-WRITER tests).
    const events = await memoryPackLifecycleEventWriter.listByPack(packId, version);
    expect(events).toHaveLength(0);
  });

  it("PACK-LIFECYCLE: appending a pack-edited event succeeds, and the two event types are distinguishable on read", async () => {
    const packId = "pack-types-distinguishable";
    const version = "v1";

    const activated = await memoryPackLifecycleEventWriter.append({
      ...BASE_PACK_EVENT,
      packId,
      packVersion: version,
      type: "PACK_ACTIVATED",
      payload: packActivatedPayload("DRAFT", "ACTIVE"),
    });
    const edited = await memoryPackLifecycleEventWriter.append({
      ...BASE_PACK_EVENT,
      packId,
      packVersion: version,
      type: "PACK_EDITED",
      payload: packEditedPayload("reviewDueOn"),
    });

    const events = await memoryPackLifecycleEventWriter.listByPack(packId, version);
    expect(events.find((event) => event.id === activated.id)?.type).toBe("PACK_ACTIVATED");
    expect(events.find((event) => event.id === edited.id)?.type).toBe("PACK_EDITED");
  });

  it("PACK-LIFECYCLE: the pack-lifecycle stream and the matter-scoped stream are genuinely separate — neither export leaks the other's events", async () => {
    const matterId = "matter-separation-check";
    const packId = "pack-separation-check";

    await memoryAuditEventWriter.append({
      matterId,
      actor: BASE_PACK_EVENT.actor,
      actorRole: "HR_PREPARER",
      at: "2026-09-19T00:00:00Z",
      type: "SUBMITTED",
      payload: transitionPayload("DRAFT", "COMPUTING"),
      rulePackVersion: null,
      engineVersion: null,
    });
    await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId });

    const matterEvents = await memoryAuditEventWriter.exportAll();
    expect(matterEvents.some((event) => event.matterId === matterId)).toBe(true);
    // A pack-lifecycle event never appears in the matter-scoped export.
    expect(matterEvents.every((event) => !("packId" in event))).toBe(true);

    const packEvents = await memoryPackLifecycleEventWriter.exportAll();
    expect(packEvents.some((event) => event.packId === packId)).toBe(true);
    // A matter-scoped event never appears in the pack-lifecycle export.
    expect(packEvents.every((event) => !("matterId" in event))).toBe(true);
  });

  it("PACK-LIFECYCLE: the stored event carries no matter identifier field at all", async () => {
    const stored = await memoryPackLifecycleEventWriter.append({ ...BASE_PACK_EVENT, packId: "pack-no-matter-id" });
    expect("matterId" in stored).toBe(false);
  });
});
