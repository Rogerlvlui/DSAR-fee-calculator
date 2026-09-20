// apps/web/src/ui/review/recompute-confirm.tsx
//
// REVIEW-10's recompute-against-current-pack affordance. Renders only when
// the jurisdiction's current pack version differs from the assessment's own
// pinned version (shouldRenderRecomputeBanner, now in
// apps/web/src/domain/recompute-banner.ts — this module carries "use
// client", so a function called from a Server Component cannot live here;
// called by the caller — apps/web/app/legal/assessments/[id]/page.tsx —
// never inside this component itself, so the gating logic is directly,
// separately testable against both directions).
//
// Split the same way disposition-controls.tsx/flat-fee-choice.tsx are: a
// pure RecomputeConfirmView (what this module's own tests render) and the
// stateful RecomputeConfirm wrapper that owns expanded/pending/error state,
// useRouter() + fetch — useRouter() throws outside a real Next.js request,
// so the stateful wrapper is never rendered directly in a test.
//
// The expand-to-confirm interaction is an IN-PLACE state toggle rendering
// more content in the SAME banner element — never a popup or an overlay of
// any kind, per the UI-SPEC's explicit "no modal, ever" instruction for any
// action that discards a lawyer's recorded work. This is the single most
// destructive action this phase adds: it clears every disposition recorded
// so far, so a lawyer must see exactly what will be lost before it runs.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface RecomputeConfirmViewProps {
  pinnedVersion: string;
  newVersion: string;
  expanded: boolean;
  pending: boolean;
  error: string | null;
  onExpand: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Pure, props-driven — no fetch, no router, no internal state. This is
 * what recompute-confirm.test.tsx renders directly. */
export function RecomputeConfirmView({
  pinnedVersion,
  newVersion,
  expanded,
  pending,
  error,
  onExpand,
  onCancel,
  onConfirm,
}: RecomputeConfirmViewProps) {
  return (
    <div data-testid="recompute-confirm-banner" className="text-warn bg-warn-wash border-warn-edge">
      <p data-testid="recompute-confirm-heading">A newer rule pack ({newVersion}) is now active.</p>
      <p data-testid="recompute-confirm-body">
        This assessment uses {pinnedVersion}. Recompute against {newVersion}?
      </p>

      {!expanded ? (
        <button type="button" data-testid="recompute-confirm-expand" disabled={pending} onClick={onExpand}>
          Recompute against current pack
        </button>
      ) : (
        <div data-testid="recompute-confirm-expanded">
          <p data-testid="recompute-confirm-warning">
            This will clear every disposition recorded so far, including any you&apos;ve already made. Recompute
            against {newVersion}?
          </p>

          {error ? (
            <p role="alert" data-testid="recompute-confirm-error">
              Recompute failed — {error}. Your dispositions have not been changed.
            </p>
          ) : null}

          {/* Stack vertically rather than overlapping/clipping on a narrow
           * viewport (06-UI-SPEC.md's own overflow backstop row) —
           * flex-col by default, row from sm: up. */}
          <div className="flex flex-col sm:flex-row" data-testid="recompute-confirm-actions">
            <button
              type="button"
              data-testid="recompute-confirm-button"
              disabled={pending}
              onClick={onConfirm}
            >
              Yes, recompute and clear dispositions
            </button>
            <button type="button" data-testid="recompute-confirm-cancel" disabled={pending} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface RecomputeConfirmProps {
  assessmentId: string;
  pinnedVersion: string;
  newVersion: string;
}

export function RecomputeConfirm({ assessmentId, pinnedVersion, newVersion }: RecomputeConfirmProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/recompute`, { method: "POST" });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      // The banner stays expanded on failure — dispositions remain exactly
      // as they were (recompute is all-or-nothing on the server).
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setPending(false);
    }
  }

  function handleCancel() {
    setExpanded(false);
    setError(null);
  }

  return (
    <RecomputeConfirmView
      pinnedVersion={pinnedVersion}
      newVersion={newVersion}
      expanded={expanded}
      pending={pending}
      error={error}
      onExpand={() => setExpanded(true)}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  );
}
