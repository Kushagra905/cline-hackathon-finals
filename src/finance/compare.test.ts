import { describe, expect, it } from "vitest";
import type { ExtractedField, FieldKey } from "../shared/schema.js";
import { compareDocuments } from "./compare.js";
import { missingCriticalKeys, toConfirmedFacts, type DocFields } from "./facts.js";
import { calculateBorrowingCost } from "./calculate.js";

// Hand-written synthetic fields for deterministic logic tests. Not AI output.
function money(key: FieldKey, doc: string, paise: number, text: string, extra: Partial<ExtractedField> = {}): ExtractedField {
  return { key, status: "found", valuePaise: paise, supportingText: text, documentId: doc, ...extra };
}
const missing = (key: FieldKey, doc: string): ExtractedField => ({ key, status: "missing", supportingText: "", documentId: doc });

const offer = (confirmed: FieldKey[] = ["netCredited"]): DocFields => ({
  fields: [money("netCredited", "offer", 950000, "We credit ₹9,500"), missing("principal", "offer"), missing("totalRepayment", "offer")],
  confirmedKeys: confirmed,
});
const kfs = (confirmed: FieldKey[]): DocFields => ({
  fields: [
    money("principal", "kfs", 1000000, "Loan principal: ₹10,000"),
    money("withheldFees", "kfs", 200000, "Charges withheld: ₹2,000"),
    money("netCredited", "kfs", 800000, "Net credited: ₹8,000"),
    money("totalRepayment", "kfs", 1050000, "Total repayment: ₹10,500"),
    { key: "tenureDays", status: "found", valueDays: 30, supportingText: "30 days", documentId: "kfs" },
  ],
  confirmedKeys: confirmed,
});
const ALL: FieldKey[] = ["principal", "withheldFees", "netCredited", "totalRepayment", "tenureDays"];

describe("compareDocuments", () => {
  it("compares net credited with net credited and carries evidence from both documents", () => {
    const { diffs } = compareDocuments(offer(), kfs(ALL));
    const d = diffs.find((x) => x.key === "netCredited")!;
    expect(d.presence).toBe("both");
    expect(d.differs).toBe(true);
    expect(d.offerValuePaise).toBe(950000);
    expect(d.kfsValuePaise).toBe(800000);
    expect(d.offerEvidence).toMatchObject({ text: "We credit ₹9,500", documentId: "offer" });
    expect(d.kfsEvidence).toMatchObject({ text: "Net credited: ₹8,000", documentId: "kfs" });
  });

  it("reports a concept present in one document only as not comparable, not as a difference", () => {
    const { diffs } = compareDocuments(offer(), kfs(ALL));
    const p = diffs.find((x) => x.key === "principal")!;
    expect(p.presence).toBe("only_kfs");
    expect(p.differs).toBe(false);
  });

  it("never treats principal as net credited", () => {
    const principalOnlyOffer: DocFields = {
      fields: [money("principal", "offer", 1000000, "₹10,000 loan")],
      confirmedKeys: ["principal"],
    };
    const { diffs, notes } = compareDocuments(principalOnlyOffer, kfs(ALL));
    const n = diffs.find((x) => x.key === "netCredited")!;
    expect(n.presence).toBe("only_kfs");
    expect(n.offerValuePaise).toBeUndefined();
    expect(diffs.find((x) => x.key === "principal")!.differs).toBe(false); // 10,000 vs 10,000
    expect(notes.some((x) => x.code === "offer_principal_not_net_credit")).toBe(true);
  });

  it("ignores unconfirmed, missing and ambiguous values", () => {
    const o = offer([]); // nothing confirmed
    expect(compareDocuments(o, kfs(ALL)).diffs.find((x) => x.key === "netCredited")!.presence).toBe("only_kfs");
    const amb: DocFields = {
      fields: [{ ...money("netCredited", "offer", 950000, "maybe ₹9,500"), status: "ambiguous" }],
      confirmedKeys: ["netCredited"],
    };
    expect(compareDocuments(amb, kfs(ALL)).diffs.find((x) => x.key === "netCredited")!.presence).toBe("only_kfs");
  });
});

describe("compareDocuments qualifiers and tenure", () => {
  it("preserves qualifiers as a note and on the evidence", () => {
    const q: DocFields = {
      fields: [money("netCredited", "offer", 950000, "from ₹9,500", { qualifier: "from", qualifierText: "from ₹9,500" })],
      confirmedKeys: ["netCredited"],
    };
    const r = compareDocuments(q, kfs(ALL));
    expect(r.notes).toContainEqual({ code: "offer_qualified_value", key: "netCredited", qualifierText: "from ₹9,500" });
    expect(r.diffs.find((x) => x.key === "netCredited")!.offerEvidence?.qualifierText).toBe("from ₹9,500");
  });

  it("compares tenure in days", () => {
    const o: DocFields = {
      fields: [{ key: "tenureDays", status: "found", valueDays: 15, supportingText: "15 days", documentId: "offer" }],
      confirmedKeys: ["tenureDays"],
    };
    const d = compareDocuments(o, kfs(ALL)).diffs.find((x) => x.key === "tenureDays")!;
    expect(d).toMatchObject({ unit: "days", offerValueDays: 15, kfsValueDays: 30, differs: true });
  });
});

describe("confirmation gating", () => {
  it("blocks numbers until net credited, repayment and tenure are confirmed", () => {
    expect(missingCriticalKeys(kfs([]))).toEqual(["netCredited", "totalRepayment", "tenureDays"]);
    expect(missingCriticalKeys(kfs(["netCredited", "totalRepayment"]))).toEqual(["tenureDays"]);
    expect(missingCriticalKeys(kfs(ALL))).toEqual([]);
  });

  it("treats a missing field as blocking even if the user confirmed it", () => {
    const d = kfs(ALL);
    d.fields = d.fields.map((f) => (f.key === "netCredited" ? missing("netCredited", "kfs") : f));
    expect(missingCriticalKeys(d)).toEqual(["netCredited"]);
  });

  it("requires the user to review AI-found unsupported-structure flags", () => {
    const d = kfs(ALL);
    d.fields.push({ key: "otherCharges", status: "found", supportingText: "processing fee payable separately", documentId: "kfs" });
    expect(missingCriticalKeys(d)).toEqual(["otherCharges"]);
    d.confirmedKeys.push("otherCharges");
    expect(calculateBorrowingCost(toConfirmedFacts("kfs", d)).error).toBe("unsupported_separately_paid_charges");
  });

  it("computes cost from confirmed net credited, not principal", () => {
    const r = calculateBorrowingCost(toConfirmedFacts("kfs", kfs(ALL)));
    expect(r.ok).toBe(true);
    expect(r.borrowingCostPaise).toBe(250000); // 10,500 - 8,000, fees not added again
    expect(r.tenureDays).toBe(30);
  });
});