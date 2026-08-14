import { describe, expect, it } from "vitest";
import { calculateMonthChain, calculateRunningBalances, calculateMonthlyTotals } from "@/lib/finance/balances";

const anchor = { id: "a", accountId: "acct", initialDate: "2026-08-01", initialBalance: 4000, status: "connected" as const };
const tx = (id: string, date: string, amount: number, sortOrder = 1000) => ({ id, accountId: "acct", userId: "u", name: id, amount, transactionDate: date, sortOrder });

describe("cash flow balances", () => {
  it("calculates running balances", () => {
    const result = calculateRunningBalances(4000, [tx("rent", "2026-08-01", -1000), tx("pay", "2026-08-07", 1000)]);
    expect(result.map((item) => item.runningBalance)).toEqual([3000, 4000]);
  });

  it("calculates monthly totals", () => {
    expect(calculateMonthlyTotals(4000, [tx("income", "2026-08-01", 2000), tx("rent", "2026-08-02", -1200)])).toEqual({
      startingBalance: 4000, totalIncome: 2000, totalExpenses: 1200, endingBalance: 4800,
    });
  });

  it("rolls an ending balance into the next month", () => {
    const result = calculateMonthChain(anchor, [tx("income", "2026-08-01", 2000), tx("rent", "2026-08-02", -1200)], [], "2026-09-01");
    expect(result.startingBalance).toBe(4800);
    expect(result.startingBalanceSource).toBe("previous_month");
  });

  it("supports a starting balance override and reconnecting by removing it", () => {
    const result = calculateMonthChain(anchor, [], [{ id: "o", accountId: "acct", userId: "u", monthStart: "2026-09-01", startingBalance: 9999 }], "2026-09-01");
    expect(result.startingBalance).toBe(9999);
    expect(result.startingBalanceSource).toBe("override");
  });

  it("orders same-day transactions by sort order", () => {
    const result = calculateRunningBalances(1000, [tx("b", "2026-08-03", -50, 2000), tx("a", "2026-08-03", -100, 1000)]);
    expect(result.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
