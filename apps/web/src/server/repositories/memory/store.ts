// apps/web/src/server/repositories/memory/store.ts
//
// The singleton, anchored to `globalThis` behind a `declare global` of a
// uniquely named optional property. A plain module-scoped map is silently
// reset by Next's Fast Refresh and can be duplicated across bundler chunks,
// which during a live walkthrough looks like the demo losing a matter the
// presenter just typed.

import "../../server-only.ts";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Assessment } from "@dsar/schemas/assessment";

interface DemoStore {
  matters: Map<string, Matter>;
  expenseLines: Map<string, ExpenseLine>;
  assessments: Map<string, Assessment>;
}

declare global {
  // eslint-disable-next-line no-var
  var __dsarDemoStore: DemoStore | undefined;
}

export const demoStore: DemoStore =
  globalThis.__dsarDemoStore ??
  (globalThis.__dsarDemoStore = {
    matters: new Map(),
    expenseLines: new Map(),
    assessments: new Map(),
  });
