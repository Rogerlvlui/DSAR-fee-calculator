// apps/web/app/page.tsx
//
// A landing page listing the two entry points (create a fee claim as HR,
// open an assessment as Legal). Plan 02 expands this into the first-use
// capability statement — this markup is what that plan wraps, not a final
// design. A plain (non-async) component: it fetches nothing and resolves no
// actor, so it renders identically whether Next serves it or a test imports
// it directly.

export default function LandingPage() {
  return (
    <main>
      <h1>New here? Two ways in.</h1>
      <p>
        This is a working prototype of the DSAR fee determination pipeline — real engine, real rule
        pack, no database yet.
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
  );
}
