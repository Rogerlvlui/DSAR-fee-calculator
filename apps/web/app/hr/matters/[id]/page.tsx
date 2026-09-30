// apps/web/app/hr/matters/[id]/page.tsx
//
// The HR result screen (PRD §10.4), plus the information-requested branch.
// An async server component: it reads the matter's status through the
// HR-scoped status read (which returns status and outstanding information
// requests but never an assessment), and requests the assessment only when
// the status is SIGNED_OFF, through the existing refusing read
// (getSignedOffAssessmentForHr). The refusal that makes this safe lives in
// the data layer, not in this page's branching — PRD §0 non-negotiable #2.
//
// Three states: waiting (PRD §10.2's closing sentence, verbatim),
// information requested (the Ask-HR panel), and signed off (the result
// view + notice draft).

import { getCurrentActor } from "../../../../src/server/current-actor.ts";
import { getExpenseLinesForHr, getHrMatterStatus, getNoticeSentAt } from "../../../../src/server/data/matters.ts";
import { getSignedOffAssessmentForHr } from "../../../../src/server/data/assessments.ts";
import { resolvePinnedRulePack } from "../../../../src/server/engine-invocation.ts";
import { buildJurisdictionPackViews } from "../../../../src/server/jurisdiction-packs.ts";
import { humanizePackDisplayStatus } from "../../../../src/domain/pack-display-status.ts";
import { EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";
import type { Minor } from "@dsar/schemas/primitives";
import { buildNoticeDraft } from "../../../../src/domain/notice-draft.ts";
import { ResultView, type ResultViewLine } from "../../../../src/ui/hr/result-view.tsx";
import { NoticeBlock } from "../../../../src/ui/hr/notice-block.tsx";
import { InfoRequestPanel, type InfoRequestPanelQuery } from "../../../../src/ui/hr/info-request-panel.tsx";
import { StatusStrip } from "../../../../src/ui/chrome/status-strip.tsx";

export default async function HrMatterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  const { matter, infoRequests } = await getHrMatterStatus(actor, id);
  const now = new Date().toISOString();
  const jurisdictionPack = buildJurisdictionPackViews(now)[matter.jurisdictionCode];
  const statusStrip = (
    <StatusStrip
      matterReference={matter.reference}
      jurisdictionName={jurisdictionPack.jurisdictionName}
      rulePackId={jurisdictionPack.packId ?? "—"}
      rulePackVersion={jurisdictionPack.version ?? "—"}
      packStatus={humanizePackDisplayStatus(jurisdictionPack.displayStatus)}
      authoredByDisplayName={jurisdictionPack.authoredByDisplayName}
      reviewedByDisplayName={jurisdictionPack.reviewedByDisplayName}
      reviewedOn={jurisdictionPack.reviewedOn}
      daysUntilReviewDue={jurisdictionPack.daysUntilReviewDue ?? 9999}
    />
  );

  if (matter.status === "INFO_REQUEST") {
    const queries: InfoRequestPanelQuery[] = infoRequests.map((request) => ({
      id: request.id,
      lineLabel: `Assessment line ${request.assessmentLineId}`,
      query: request.query,
      raisedAt: request.raisedAt,
    }));

    return (
      <main className="flex flex-col gap-xl">
        <h1 className="screen">Fee assessment — {matter.reference}</h1>
        {statusStrip}
        <InfoRequestPanel matterId={matter.id} queries={queries} />
      </main>
    );
  }

  // Widened (04-05 Task 2) to also let CLOSED through: once marking the
  // notice sent closes the matter, a closed matter is still a signed one,
  // and the preparer must not lose sight of the figure the moment it
  // closes. Every earlier status still falls into the waiting branch.
  if (matter.status !== "SIGNED_OFF" && matter.status !== "CLOSED") {
    return (
      <main className="flex flex-col gap-xl">
        <h1 className="screen">Fee assessment — {matter.reference}</h1>
        {statusStrip}
        <p data-testid="hr-waiting">
          This claim is in Legal&apos;s review queue. You&apos;ll see the assessed fee after lawyer
          sign-off; no draft figure is shown here.
        </p>
      </main>
    );
  }

  const assessment = await getSignedOffAssessmentForHr(actor, id);
  const expenseLines = await getExpenseLinesForHr(actor, id);
  const expenseLineById = new Map(expenseLines.map((line) => [line.id, line]));

  const resultLines: ResultViewLine[] = assessment.lines.map((line) => {
    const expenseLine = expenseLineById.get(line.expenseLineId);
    const amount: Minor =
      line.disposition === "ACCEPTED"
        ? line.engineAmount
        : line.disposition === "REDUCED" || line.disposition === "ALLOWED_BY_LAWYER"
          ? ((line.lawyerAmount ?? 0) as Minor)
          : (0 as Minor);

    return {
      id: line.id,
      seq: expenseLine?.seq ?? 0,
      categoryLabel: expenseLine ? EXPENSE_CATEGORY_LABELS[expenseLine.categoryCode] : "Unknown category",
      description: expenseLine?.description ?? "",
      struck: line.disposition === "STRUCK",
      amount,
      basis: line.basis,
    };
  });

  const finalAmount = (assessment.totals.finalAmount ?? 0) as Minor;

  const allowedLinesForNotice = resultLines
    .filter((line) => !line.struck)
    .map((line) => ({ description: line.description, amount: line.amount }));

  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
  const noticeDraft = buildNoticeDraft({
    template: pack.requestorNoticeTemplate,
    amount: finalAmount,
    currency: matter.currency,
    allowedLines: allowedLinesForNotice,
    matterReference: matter.reference,
    requestReceivedOn: matter.requestReceivedOn,
  });

  const noticeSentAt = getNoticeSentAt(matter.id);

  return (
    <main className="flex flex-col gap-xl">
      <h1 className="screen">Fee assessment — {matter.reference}</h1>
      <ResultView
        matterReference={matter.reference}
        finalAmount={finalAmount}
        currency={matter.currency}
        lawyerName={assessment.signOff?.lawyerName ?? ""}
        qualification={assessment.signOff?.qualification ?? ""}
        signedAt={assessment.signOff?.signedAt ?? ""}
        lines={resultLines}
      />
      <NoticeBlock draft={noticeDraft} noticeSentAt={noticeSentAt} />
    </main>
  );
}
