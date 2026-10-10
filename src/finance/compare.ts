import type { ConceptDiff, FieldKey } from "../shared/schema.js";
import { usableField, type DocFields } from "./facts.js";

/**
 * Compares EQUIVALENT quantities only (principal vs principal, net credited vs
 * net credited, ...). Principal is never compared with, or substituted for, net
 * credited. Only user-confirmed, found values take part. A concept present in
 * one document only is "not comparable", not a difference.
 */
const MONEY_KEYS: FieldKey[] = ["principal", "netCredited", "withheldFees", "totalRepayment"];

export type CompareNoteCode =
  | "offer_principal_not_net_credit" // offer states principal but no confirmed net credited
  | "offer_qualified_value"; // offer value carries "from" / "up to" / approx

export interface CompareNote {
  code: CompareNoteCode;
  key?: FieldKey;
  qualifierText?: string;
}

export interface CompareResult {
  diffs: ConceptDiff[];
  notes: CompareNote[];
}

export function compareDocuments(offer: DocFields | undefined, kfs: DocFields | undefined): CompareResult {
  const diffs: ConceptDiff[] = [];
  const notes: CompareNote[] = [];

  const evidence = (f: ReturnType<typeof usableField>) =>
    f ? { text: f.supportingText, documentId: f.documentId, qualifierText: f.qualifierText } : undefined;

  for (const key of [...MONEY_KEYS, "tenureDays" as FieldKey]) {
    const o = usableField(offer, key);
    const k = usableField(kfs, key);
    const isDays = key === "tenureDays";
    const presence: ConceptDiff["presence"] = o && k ? "both" : o ? "only_offer" : k ? "only_kfs" : "neither";
    const ov = isDays ? o?.valueDays : o?.valuePaise;
    const kv = isDays ? k?.valueDays : k?.valuePaise;
    diffs.push({
      key,
      unit: isDays ? "days" : "money",
      presence,
      offerValuePaise: isDays ? undefined : o?.valuePaise,
      kfsValuePaise: isDays ? undefined : k?.valuePaise,
      offerValueDays: isDays ? o?.valueDays : undefined,
      kfsValueDays: isDays ? k?.valueDays : undefined,
      differs: presence === "both" && ov !== kv,
      offerEvidence: evidence(o),
      kfsEvidence: evidence(k),
    });
    if (o && (o.qualifier === "from" || o.qualifier === "up_to" || o.qualifier === "approx")) {
      notes.push({ code: "offer_qualified_value", key, qualifierText: o.qualifierText });
    }
  }

  if (usableField(offer, "principal") && !usableField(offer, "netCredited")) {
    notes.push({ code: "offer_principal_not_net_credit", key: "principal" });
  }
  return { diffs, notes };
}
