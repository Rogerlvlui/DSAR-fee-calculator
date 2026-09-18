// apps/web/app/page.tsx
//
// The gated entry point: the first-use capability statement renders until
// it has been acknowledged (browser-local, apps/web/src/ui/capability), and
// the landing links to the two entry paths render afterwards. Marked async
// so tests/boundary/dom-denylist.test.ts's glob half treats this page the
// same way it treats every other page whose tree cannot render outside a
// real Next request context (CapabilityStatement is a client component) —
// the gating itself is entirely client-side, in CapabilityStatement.

import { CapabilityStatement } from "../src/ui/capability/capability-statement.tsx";

export default async function LandingPage() {
  return (
    <CapabilityStatement>
      <main>
        <h1>New here? Two ways in.</h1>
        <p>
          This is a working prototype of the DSAR fee determination pipeline — real engine, real
          rule pack, no database yet.
        </p>
        <ul>
          <li>
            <a href="/hr/matters/new">Create a fee claim, as HR</a>
          </li>
          <li>
            <a href="/legal/assessments">Open an assessment, as Legal</a>
          </li>
        </ul>
      </main>
    </CapabilityStatement>
  );
}
