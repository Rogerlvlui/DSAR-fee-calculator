// apps/web/app/(hr)/matters/new/page.tsx
//
// An async server component: builds the pack view (server-side) and hands
// it to IntakeForm as props. Marked async — even though buildIntakePackView
// itself is synchronous — so tests/boundary/dom-denylist.test.ts's glob
// half defers this page the same way it defers every other page whose tree
// cannot render outside a real Next request context (IntakeForm calls
// next/navigation's useRouter, which needs an app-router context this
// glob's static render never provides).

import { buildIntakePackView } from "../../../../src/server/pack-view.ts";
import { IntakeForm } from "../../../../src/ui/intake/intake-form.tsx";

function suggestReference(): string {
  const year = new Date().getUTCFullYear();
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `DSAR-${year}-${suffix}`;
}

export default async function NewMatterPage() {
  const packView = buildIntakePackView();

  return (
    <main>
      <h1 className="screen">New fee claim</h1>
      <p className="caption">
        HR records what the response actually cost. <b>HR never sees a draft figure</b> — the
        claim goes to Legal, and HR sees a fee only once a lawyer has signed it off.
      </p>
      <IntakeForm packView={packView} defaultReference={suggestReference()} />
    </main>
  );
}
