import type { ConfirmedFacts, ExtractedField, FieldKey } from "../shared/schema.js";

export interface DocFields {
  fields: ExtractedField[];
  /** keys the USER confirmed in the UI. Never set from model output. */
  confirmedKeys: FieldKey[];
}

/**
 * A field is usable only if the user confirmed it AND it is "found" with a value.
 * Missing/ambiguous fields are never usable, whatever the model said.
 */
export function usableField(doc: DocFields | undefined, key: FieldKey): ExtractedField | undefined {
  if (!doc || !doc.confirmedKeys.includes(key)) return undefined;
  const f = doc.fields.find((x) => x.key === key);
  if (!f || f.status !== "found") return undefined;
  if (key === "tenureDays") return f.valueDays !== undefined ? f : undefined;
  if (key === "repaymentCount") return f.valueCount !== undefined ? f : undefined;
  if (key === "otherCharges") return f;
  if (key === "disbursalDate" || key === "repaymentDate") return f.valueDate !== undefined ? f : undefined;
  return f.valuePaise !== undefined ? f : undefined;
}

/** Build finance-module input from USER-CONFIRMED facts only. */
export function toConfirmedFacts(documentId: string, doc: DocFields): ConfirmedFacts {
  const money = (k: FieldKey) => usableField(doc, k)?.valuePaise;
  return {
    documentId,
    principalPaise: money("principal"),
    netCreditedPaise: money("netCredited"),
    withheldFeesPaise: money("withheldFees"),
    withheldTaxesPaise: money("withheldTaxes"),
    totalRepaymentPaise: money("totalRepayment"),
    tenureDays: usableField(doc, "tenureDays")?.valueDays,
    disbursalDate: usableField(doc, "disbursalDate")?.valueDate,
    repaymentDate: usableField(doc, "repaymentDate")?.valueDate,
    // an otherCharges field that is found means the document mentions separately payable charges
    separatelyPaidCharges: usableField(doc, "otherCharges") !== undefined,
    repaymentCount: usableField(doc, "repaymentCount")?.valueCount,
  };
}

/**
 * Facts that block numerical conclusions for the FINAL TERMS document:
 * net credited, total repayment and tenure must be user-confirmed and found.
 * Principal is NOT critical for the cost (it is only compared); it is never
 * used as a substitute for net credited. Unsupported-structure flags the AI
 * found (separate charges, repayment count) must also be reviewed by the user.
 */
export function missingCriticalKeys(doc: DocFields): FieldKey[] {
  const missing: FieldKey[] = [];
  for (const k of ["netCredited", "totalRepayment"] as FieldKey[]) {
    if (!usableField(doc, k)) missing.push(k);
  }
  const hasTenure =
    usableField(doc, "tenureDays") ||
    (usableField(doc, "disbursalDate") && usableField(doc, "repaymentDate"));
  if (!hasTenure) missing.push("tenureDays");
  for (const k of ["otherCharges", "repaymentCount"] as FieldKey[]) {
    const f = doc.fields.find((x) => x.key === k);
    if (f && f.status !== "missing" && !doc.confirmedKeys.includes(k)) missing.push(k);
  }
  return missing;
}