import { z } from "zod";

/**
 * Shared schema: single source of truth for client and server.
 * Money is ALWAYS integer paise. LLMs are never asked to do arithmetic;
 * the model returns rupee strings + verbatim supporting text and the
 * server parses them to paise.
 */

export const FieldStatus = z.enum(["found", "missing", "ambiguous"]);
export type FieldStatus = z.infer<typeof FieldStatus>;

export const FieldKey = z.enum([
  "principal",
  "netCredited",
  "withheldFees",
  "withheldTaxes",
  "totalRepayment",
  "tenureDays",
  "disbursalDate",
  "repaymentDate",
  // flags, not money:
  "otherCharges", // charges payable separately (unsupported initially)
  "repaymentCount", // number of repayments (must be 1)
]);
export type FieldKey = z.infer<typeof FieldKey>;

export const Qualifier = z.enum(["from", "up_to", "approx", "other"]);
export type Qualifier = z.infer<typeof Qualifier>;

export const ExtractedField = z.object({
  key: FieldKey,
  status: FieldStatus,
  /** integer paise for money fields */
  valuePaise: z.number().int().optional(),
  /** integer days for tenureDays */
  valueDays: z.number().int().positive().optional(),
  /** ISO date YYYY-MM-DD for date fields */
  valueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** count for repaymentCount */
  valueCount: z.number().int().positive().optional(),
  qualifier: Qualifier.optional(),
  /** verbatim text of the qualifier, e.g. "from ₹10,000" */
  qualifierText: z.string().optional(),
  /** verbatim supporting text from the document; required when status=found */
  supportingText: z.string(),
  documentId: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  /** "ai" = extracted by the model; "user" = typed or corrected by the borrower in the UI */
  origin: z.enum(["ai", "user"]).optional(),
});
export type ExtractedField = z.infer<typeof ExtractedField>;

export const DocumentKind = z.enum(["offer", "kfs"]);
export type DocumentKind = z.infer<typeof DocumentKind>;

export const DocumentExtraction = z.object({
  documentId: z.string(),
  kind: DocumentKind,
  language: z.enum(["en", "hi", "mixed", "unknown"]),
  fields: z.array(ExtractedField),
  extractedAt: z.string(),
  warnings: z.array(z.string()),
});
export type DocumentExtraction = z.infer<typeof DocumentExtraction>;

export const CorrectionAction = z.enum(["confirm", "correct", "mark_missing"]);
export type CorrectionAction = z.infer<typeof CorrectionAction>;

export const UserCorrection = z.object({
  documentId: z.string(),
  key: FieldKey,
  action: CorrectionAction,
  /** replacement field for "correct" */
  newField: ExtractedField.optional(),
  at: z.string(),
});
export type UserCorrection = z.infer<typeof UserCorrection>;

export const SessionState = z.enum([
  "created",
  "uploaded",
  "extracting",
  "extracted",
  "reviewing",
  "confirmed",
  "calculated",
  "failed",
]);
export type SessionState = z.infer<typeof SessionState>;

export const CriticalKeys: FieldKey[] = [
  "netCredited",
  "totalRepayment",
  "principal",
];
/** tenure requires either tenureDays OR (disbursalDate AND repaymentDate) */
export const TenureAlternatives = {
  primary: "tenureDays" as FieldKey,
  alternative: ["disbursalDate", "repaymentDate"] as FieldKey[],
};

export interface DocState {
  doc: DocumentExtraction;
  confirmedKeys: FieldKey[];
}

export interface Session {
  id: string;
  state: SessionState;
  /** immutable original extractions, keyed by documentId */
  original: Record<string, DocumentExtraction>;
  /** append-only correction log */
  corrections: UserCorrection[];
  /** confirmed keys per documentId — set ONLY via the confirm route */
  confirmed: Record<string, FieldKey[]>;
  /** computed once state=calculated */
  result?: CalculationResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** A confirmed money fact passed to the finance module (server-held). */
export interface ConfirmedFacts {
  documentId: string;
  principalPaise?: number;
  netCreditedPaise?: number;
  withheldFeesPaise?: number;
  withheldTaxesPaise?: number;
  totalRepaymentPaise?: number;
  tenureDays?: number;
  disbursalDate?: string;
  repaymentDate?: string;
  /** true when document says other charges are payable separately */
  separatelyPaidCharges: boolean;
  repaymentCount?: number;
}

export type CalcError =
  | "unsupported_separately_paid_charges"
  | "unsupported_multiple_repayments"
  | "missing_net_credited"
  | "missing_total_repayment"
  | "repayment_less_than_net_credited";

export interface CalculationResult {
  ok: boolean;
  error?: CalcError;
  /** total repayment - net credited, in integer paise */
  borrowingCostPaise?: number;
  tenureDays?: number;
  /** cost per day in paise (stretch, only if tenure known) */
  costPerDayPaise?: number;
  caveats: string[];
}

export interface ConceptDiff {
  key: FieldKey;
  /** "both" | "only_offer" | "only_kfs" | "neither" */
  presence: "both" | "only_offer" | "only_kfs" | "neither";
  /** "money" compares paise, "days" compares whole days (tenureDays) */
  unit?: "money" | "days";
  offerValuePaise?: number;
  offerValueDays?: number;
  kfsValueDays?: number;
  kfsValuePaise?: number;
  /** true when both present and values differ */
  differs: boolean;
  offerEvidence?: { text: string; documentId: string; qualifierText?: string; origin?: "ai" | "user" };
  kfsEvidence?: { text: string; documentId: string; qualifierText?: string; origin?: "ai" | "user" };
}

export interface FullResult {
  state: SessionState;
  calculation: CalculationResult;
  diffs: ConceptDiff[];
}

export const CONFIRMATION_SENTINEL = "server-verified" as const;
