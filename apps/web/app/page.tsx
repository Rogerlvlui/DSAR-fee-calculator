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
import { RoleSwitchButton } from "../src/ui/chrome/app-header.tsx";
import { DEMO_ROLE_COOKIE } from "../src/server/data/auth.ts";

export default async function LandingPage() {
  return (
    <CapabilityStatement>
      <main className="landing">
        <h1 className="screen">From cost claim to legal decision</h1>
        <p className="lede">Record a data access request&apos;s costs, review each line against the draft Singapore rule pack, then release a signed result.</p>
        <div className="landing-paths">
          <section className="card landing-path">
            <h2>Prepare a claim</h2>
            <p>Enter the response costs and send them to Legal.</p>
            <RoleSwitchButton cookieName={DEMO_ROLE_COOKIE} role="HR_PREPARER" href="/hr/matters/new" className="btn btn-primary">Continue as HR</RoleSwitchButton>
          </section>
          <section className="card landing-path">
            <h2>Review a claim</h2>
            <p>Decide each line and sign off the assessed fee.</p>
            <RoleSwitchButton cookieName={DEMO_ROLE_COOKIE} role="LEGAL_REVIEWER" href="/legal/queue" className="btn btn-secondary">Continue as Legal</RoleSwitchButton>
          </section>
        </div>
      </main>
    </CapabilityStatement>
  );
}
