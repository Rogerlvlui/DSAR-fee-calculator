// apps/web/src/ui/chrome/demo-banner.tsx
//
// Permanent chrome, directly under the app header on every screen. It
// carries no close button and no dismiss state: success criterion 5 names
// this banner separately from the capability statement precisely because it
// must never be dismissible. Imports nothing from the app's server-side
// module tree.

export const DEMO_BANNER_TEXT =
  "DEMO BUILD — holds no persistent data. Nothing entered here is saved once this session or process ends.";

export function DemoBanner() {
  return (
    <div role="note" aria-label="Demo build notice" data-testid="demo-banner">
      <p>{DEMO_BANNER_TEXT}</p>
    </div>
  );
}
