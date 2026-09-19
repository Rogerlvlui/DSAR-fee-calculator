// apps/web/src/domain/advisory-deadline.ts
//
// The one shared home for the advisory-deadline date arithmetic, extracted
// verbatim (no behavior change) from apps/web/src/server/review-view.ts
// (addDaysToIsoDate, computeAdvisoryDeadline, AdvisoryDeadlineView) and
// apps/web/src/ui/review/matter-rail.tsx (ADVISORY_QUALIFIER). Lives under
// apps/web/src/domain/ — the existing home for pure logic shared between
// apps/web/src/ui and apps/web/src/server (alongside review-tallies.ts,
// verdict-order.ts) — so neither side's dependency-cruiser boundary is
// violated by importing it.
//
// The real committed pack sets `feeNotificationDeadlineDays: null` and
// `responseDeadlineDays: 30`, so the advisory line falls back to the
// response deadline exactly as Annex A's own SG card does
// (docs/dsar-fee-agent-mockup.html:934) — never inventing a fee-
// notification date the pack doesn't set.

import { daysUntil } from "@dsar/engine/calendar-math";
import type { Matter } from "@dsar/schemas/matter";

export interface AdvisoryDeadlineView {
  /** "FEE_NOTIFICATION" when the pack sets its own fee-notification
   * deadline; "RESPONSE_DEADLINE_FALLBACK" when it doesn't and the response
   * deadline is shown instead, exactly as Annex A does. */
  basis: "FEE_NOTIFICATION" | "RESPONSE_DEADLINE_FALLBACK";
  dueDateIso: string;
  daysRemaining: number;
}

export const ADVISORY_QUALIFIER = "Advisory only. This tool is not the deadline system of record.";

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function computeAdvisoryDeadline(
  matter: Matter,
  constraints: { feeNotificationDeadlineDays: number | null; responseDeadlineDays: number | null },
  nowIso: string
): AdvisoryDeadlineView | null {
  const basis: AdvisoryDeadlineView["basis"] | null =
    constraints.feeNotificationDeadlineDays != null
      ? "FEE_NOTIFICATION"
      : constraints.responseDeadlineDays != null
        ? "RESPONSE_DEADLINE_FALLBACK"
        : null;
  if (basis === null) return null;

  const days =
    basis === "FEE_NOTIFICATION" ? constraints.feeNotificationDeadlineDays! : constraints.responseDeadlineDays!;
  const dueDateIso = addDaysToIsoDate(matter.requestReceivedOn, days);
  return { basis, dueDateIso, daysRemaining: daysUntil(nowIso, dueDateIso) };
}
