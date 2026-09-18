// apps/web/src/ui/intake/matter-details-fields.tsx
//
// Section 1 of the HR intake screen (PRD §10.2): reference, jurisdiction,
// legal entity, controller type, request received date, currency and
// requestor class. Currency is derived from the chosen jurisdiction through
// JURISDICTION_CURRENCY and rendered read-only — it is not a free choice.
// The heads-up paragraph (PRD §10.2, verbatim) renders the moment the
// current jurisdiction/controller-type combination's fee posture records
// no express authority or prohibits a fee, before section 3 becomes
// reachable. Imports nothing from apps/web/src/server — feePosture arrives
// as a prop, already resolved by the caller.

"use client";

import { JURISDICTION_CURRENCY, type ControllerType, type CurrencyCode, type JurisdictionCode } from "@dsar/schemas/primitives";
import type { RequestorClass } from "@dsar/schemas/matter";
import type { FeePosture } from "@dsar/schemas/rule-pack";

export interface MatterDetailsValue {
  reference: string;
  jurisdictionCode: JurisdictionCode;
  legalEntity: string;
  controllerType: ControllerType;
  requestReceivedOn: string;
  requestorClass: RequestorClass;
}

// PRD names nine jurisdictions (§7.4); only SG-PDPA is wired to a real pack
// in this demo (03.1-RESEARCH.md) — every other jurisdiction is offered so
// the currency-per-jurisdiction mechanic is honestly demonstrable, and
// resolves to the same "no express authority" heads-up as SG's own
// PUBLIC_AGENCY posture, because this demo has no real pack data for them.
export const JURISDICTION_NAMES: Record<JurisdictionCode, string> = {
  SG: "Singapore",
  HK: "Hong Kong SAR",
  AU: "Australia",
  NZ: "New Zealand",
  JP: "Japan",
  KR: "South Korea",
  CN: "China",
  IN: "India",
  VN: "Vietnam",
};

const CONTROLLER_TYPE_LABELS: Record<ControllerType, string> = {
  PRIVATE_ORGANISATION: "Private organisation",
  PUBLIC_AGENCY: "Public agency",
};

const REQUESTOR_CLASS_LABELS: Record<RequestorClass, string> = {
  FORMER_EMPLOYEE: "Former employee",
  CURRENT_EMPLOYEE: "Current employee",
  OTHER: "Other",
};

const HEADS_UP_POSTURES = new Set<FeePosture>(["NO_EXPRESS_AUTHORITY", "PROHIBITED"]);

/** PRD §10.2's heads-up paragraph, verbatim with {Jurisdiction} filled in. */
export function headsUpMessage(jurisdictionName: string): string {
  return `Heads up — ${jurisdictionName}. Our rule pack records no clear legal basis for charging a fee for a data access request in this jurisdiction. You can still record the costs, but the likely outcome is that Legal advises charging nothing. Talk to Legal before spending time on this.`;
}

export interface MatterDetailsFieldsProps {
  value: MatterDetailsValue;
  onChange: (value: MatterDetailsValue) => void;
  /** Derived by the caller via JURISDICTION_CURRENCY[value.jurisdictionCode]. */
  currency: CurrencyCode;
  /** The real fee posture for value.jurisdictionCode + value.controllerType,
   * already resolved by the caller from the loaded pack view — this
   * component never invents one. */
  feePosture: FeePosture;
}

export function MatterDetailsFields({ value, onChange, currency, feePosture }: MatterDetailsFieldsProps) {
  const jurisdictionName = JURISDICTION_NAMES[value.jurisdictionCode];
  const showHeadsUp = HEADS_UP_POSTURES.has(feePosture);

  function set<K extends keyof MatterDetailsValue>(key: K, next: MatterDetailsValue[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <section data-testid="matter-details-fields">
      <h2>Matter details</h2>
      <div>
        <label>
          <span>Matter reference</span>
          <input
            name="reference"
            value={value.reference}
            onChange={(event) => set("reference", event.target.value)}
          />
        </label>
        <label>
          <span>Jurisdiction</span>
          <select
            name="jurisdictionCode"
            value={value.jurisdictionCode}
            onChange={(event) => set("jurisdictionCode", event.target.value as JurisdictionCode)}
          >
            {Object.entries(JURISDICTION_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Legal entity</span>
          <input
            name="legalEntity"
            value={value.legalEntity}
            onChange={(event) => set("legalEntity", event.target.value)}
          />
        </label>
        <label>
          <span>Controller type</span>
          <select
            name="controllerType"
            value={value.controllerType}
            onChange={(event) => set("controllerType", event.target.value as ControllerType)}
          >
            {Object.entries(CONTROLLER_TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Request received</span>
          <input
            name="requestReceivedOn"
            type="date"
            value={value.requestReceivedOn}
            onChange={(event) => set("requestReceivedOn", event.target.value)}
          />
        </label>
        <label>
          <span>Currency</span>
          <input name="currency" value={currency} readOnly />
          <p data-testid="currency-explanation">
            Fixed by jurisdiction, not a free choice — every {value.jurisdictionCode} matter uses{" "}
            {JURISDICTION_CURRENCY[value.jurisdictionCode]}.
          </p>
        </label>
      </div>
      {/* Requestor class (PRD §6.1) is shown as fixed hint text, not an
          editable control, matching Annex A exactly
          (docs/dsar-fee-agent-mockup.html:760): the point of this line is
          "there is no field for the requestor's name or ID", and an
          editable field whose own name/label carries the word "requestor"
          would sit uncomfortably next to that claim. The value itself
          still lives in MatterDetailsValue (the caller defaults it to
          FORMER_EMPLOYEE, the case PRD §14's reference fixture uses) and
          is submitted with the matter — only the editable control is
          removed, not the field. */}
      <p className="hint">
        Requestor class: <b>{REQUESTOR_CLASS_LABELS[value.requestorClass].toLowerCase()}</b>. There is no field
        for the requestor&apos;s name or ID anywhere in this tool.
      </p>
      {showHeadsUp ? (
        <div data-testid="heads-up-warning" className="posture">
          {headsUpMessage(jurisdictionName)}
        </div>
      ) : null}
    </section>
  );
}
