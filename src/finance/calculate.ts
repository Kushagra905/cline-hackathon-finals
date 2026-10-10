import type { CalculationResult, ConfirmedFacts } from "../shared/schema.js";

/**
 * Pure borrowing-cost calculation. All inputs are server-held CONFIRMED
 * facts in integer paise. No LLM output reaches this function unverified.
 *
 * Semantics (frozen):
 * - Charges withheld from disbursal are already reflected in net credited:
 *     borrowingCost = totalRepayment - netCredited
 *   Withheld fees/taxes are NEVER added again (no double counting).
 * - Separately paid charges and multiple repayments are unsupported.
 */
export function calculateBorrowingCost(facts: ConfirmedFacts): CalculationResult {
  const caveats: string[] = [];

  if (facts.separatelyPaidCharges) {
    return {
      ok: false,
      error: "unsupported_separately_paid_charges",
      caveats: [
        "This document mentions charges payable separately from the disbursal. " +
          "LoanClear cannot compute a complete borrowing cost in that case.",
      ],
    };
  }
  if (facts.repaymentCount !== undefined && facts.repaymentCount !== 1) {
    return {
      ok: false,
      error: "unsupported_multiple_repayments",
      caveats: [
        "This loan has multiple repayments. LoanClear currently supports a single repayment at the end.",
      ],
    };
  }
  if (facts.netCreditedPaise === undefined) {
    return {
      ok: false,
      error: "missing_net_credited",
      caveats: [
        "Net amount credited to your account could not be confirmed. " +
          "An advertised principal (e.g. “₹10,000 loan”) alone does not prove that amount was credited.",
      ],
    };
  }
  if (facts.totalRepaymentPaise === undefined) {
    return {
      ok: false,
      error: "missing_total_repayment",
      caveats: ["Total repayment amount could not be confirmed."],
    };
  }

  const cost = facts.totalRepaymentPaise - facts.netCreditedPaise;
  if (cost < 0) {
    return {
      ok: false,
      error: "repayment_less_than_net_credited",
      caveats: [
        "Total repayment is less than the net amount credited — please re-check the confirmed values.",
      ],
    };
  }

  let tenureDays = facts.tenureDays;
  if (tenureDays === undefined && facts.disbursalDate && facts.repaymentDate) {
    tenureDays = daysBetweenSafe(facts.disbursalDate, facts.repaymentDate) ?? undefined;
  }
  if (facts.withheldFeesPaise !== undefined || facts.withheldTaxesPaise !== undefined) {
    caveats.push(
      "Fees/taxes withheld from the disbursal are already reflected in the net credited amount " +
        "and are not added again."
    );
  }
  if (tenureDays === undefined || tenureDays <= 0) {
    caveats.push("Loan tenure could not be confirmed, so no per-day figure is shown.");
  }

  return {
    ok: true,
    borrowingCostPaise: cost,
    tenureDays: tenureDays && tenureDays > 0 ? tenureDays : undefined,
    costPerDayPaise:
      tenureDays && tenureDays > 0 ? Math.trunc(cost / tenureDays) : undefined,
    caveats,
  };
}

function daysBetweenSafe(a: string, b: string): number | null {
  const ta = Date.parse(a + "T00:00:00Z");
  const tb = Date.parse(b + "T00:00:00Z");
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / 86_400_000);
}
