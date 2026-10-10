import { describe, expect, it } from "vitest";
import { validateExtraction } from "./m0-validate.js";

// NOTE: these inputs are hand-written synthetic objects testing the validator only.
// They are NOT SDK output and do not count as SDK verification.
const expectedKfs = {
  principal: { status: "found" as const, valuePaise: 1000000 },
  netCredited: { status: "found" as const, valuePaise: 800000 },
  totalRepayment: { status: "found" as const, valuePaise: 1050000 },
  tenureDays: { status: "found" as const, valueDays: 30 },
};

describe("validateExtraction (validator only, hand-written input)", () => {
  it("accepts correct fields and parses rupee text to paise", () => {
    const r = validateExtraction(
      {
        documentId: "kfs",
        fields: [
          { key: "principal", status: "found", rupeeText: "₹10,000", supportingText: "Loan principal: ₹10,000" },
          { key: "netCredited", status: "found", rupeeText: "₹8,000", supportingText: "Net amount credited: ₹8,000" },
          { key: "totalRepayment", status: "found", rupeeText: "₹10,500", supportingText: "Total repayment: ₹10,500" },
          { key: "tenureDays", status: "found", days: 30, supportingText: "30 days after disbursal" },
        ],
      },
      "kfs",
      expectedKfs,
    );
    expect(r.problems).toEqual([]);
    expect(r.paise.netCredited).toBe(800000);
  });

  it("treats an absent field as missing and rejects a filled-in expected-missing field", () => {
    const expected = { netCredited: { status: "missing" as const } };
    const absent = validateExtraction({ documentId: "offer", fields: [] }, "offer", expected);
    expect(absent.ok).toBe(true);
    const filled = validateExtraction(
      { documentId: "offer", fields: [{ key: "netCredited", status: "found", rupeeText: "₹10,000", supportingText: "₹10,000 loan" }] },
      "offer",
      expected,
    );
    expect(filled.ok).toBe(false);
  });

  it("rejects found without supporting text and values on missing fields", () => {
    const r = validateExtraction(
      {
        documentId: "kfs",
        fields: [
          { key: "principal", status: "found", rupeeText: "₹10,000", supportingText: "" },
          { key: "netCredited", status: "missing", rupeeText: "₹8,000", supportingText: "" },
        ],
      },
      "kfs",
      {},
    );
    expect(r.problems.length).toBe(2);
  });
});
