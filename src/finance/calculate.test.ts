import { describe, expect, it } from "vitest";
import { calculateBorrowingCost } from "./calculate.js";
import { parseRupeesToPaise } from "./money.js";

describe("calculateBorrowingCost (existing finance module)", () => {
  it("withheld fees are not double counted: cost = repayment - net credited", () => {
    const r = calculateBorrowingCost({
      documentId: "kfs",
      principalPaise: 1000000,
      netCreditedPaise: 800000,
      withheldFeesPaise: 200000,
      totalRepaymentPaise: 1050000,
      tenureDays: 30,
      separatelyPaidCharges: false,
      repaymentCount: 1,
    });
    expect(r.ok).toBe(true);
    expect(r.borrowingCostPaise).toBe(250000);
  });

  it("does not assume principal equals net credited", () => {
    const r = calculateBorrowingCost({
      documentId: "offer",
      principalPaise: 1000000,
      totalRepaymentPaise: 1050000,
      separatelyPaidCharges: false,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing_net_credited");
  });

  it("refuses multiple repayments and separately paid charges", () => {
    const base = { documentId: "kfs", netCreditedPaise: 800000, totalRepaymentPaise: 1050000 };
    expect(calculateBorrowingCost({ ...base, separatelyPaidCharges: true }).ok).toBe(false);
    expect(calculateBorrowingCost({ ...base, separatelyPaidCharges: false, repaymentCount: 3 }).error).toBe(
      "unsupported_multiple_repayments",
    );
  });
});

describe("parseRupeesToPaise", () => {
  it("parses Indian grouping, symbols and Hindi digits to integer paise", () => {
    expect(parseRupeesToPaise("₹10,000")).toBe(1000000);
    expect(parseRupeesToPaise("Rs. 1,00,000.50")).toBe(10000050);
    expect(parseRupeesToPaise("१०,०००")).toBe(1000000);
    expect(parseRupeesToPaise("abc")).toBeNull();
  });
});
