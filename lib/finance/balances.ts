import type {
  BalanceAnchor,
  BalanceOverride,
  CalculatedTransaction,
  MonthlySummary,
  Transaction,
} from "@/types/finance";

export function sortTransactions(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const date = a.transactionDate.localeCompare(b.transactionDate);
    return date !== 0 ? date : a.sortOrder - b.sortOrder;
  });
}

export function calculateRunningBalances(startingBalance: number, transactions: Transaction[]): CalculatedTransaction[] {
  let balance = startingBalance;
  return sortTransactions(transactions).map((transaction) => {
    balance += transaction.amount;
    return { ...transaction, runningBalance: balance };
  });
}

export function calculateMonthlyTotals(startingBalance: number, transactions: Transaction[]): MonthlySummary {
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return {
    startingBalance,
    totalIncome,
    totalExpenses,
    endingBalance: startingBalance + totalIncome - totalExpenses,
  };
}

export function calculateEndingBalance(startingBalance: number, transactions: Transaction[]): number {
  return calculateRunningBalances(startingBalance, transactions).at(-1)?.runningBalance ?? startingBalance;
}

export function calculateNextMonthStartingBalance(endingBalance: number): number {
  return endingBalance;
}

export function calculateMonthChain(
  anchor: BalanceAnchor,
  transactions: Transaction[],
  overrides: BalanceOverride[],
  targetMonth: string,
): MonthCalculationResult {
  const anchorMonth = anchor.initialDate.slice(0, 7) + "-01";
  if (targetMonth < anchorMonth) {
    return {
      monthStart: targetMonth,
      startingBalance: null,
      startingBalanceSource: "untracked",
      previousMonthEndingBalance: null,
      transactions: [],
      summary: null,
    };
  }

  const months: string[] = [];
  let cursor = anchorMonth;
  while (cursor <= targetMonth) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  let previousEnding: number | null = null;
  let result: MonthCalculationResult | null = null;

  for (const monthStart of months) {
    const priorEnding = previousEnding;
    const override = overrides.find((item) => item.monthStart === monthStart);
    const monthTransactions = transactions.filter((transaction) => transaction.transactionDate.slice(0, 7) === monthStart.slice(0, 7));

    const startingBalance = override?.startingBalance ?? (monthStart === anchorMonth ? anchor.initialBalance : previousEnding);
    const source = override ? "override" : monthStart === anchorMonth ? "initial" : "previous_month";

    if (startingBalance === null) {
      result = {
        monthStart,
        startingBalance: null,
        startingBalanceSource: "untracked",
        previousMonthEndingBalance: previousEnding,
        transactions: [],
        summary: null,
      };
      continue;
    }

    const calculatedTransactions = calculateRunningBalances(startingBalance, monthTransactions);
    const summary = calculateMonthlyTotals(startingBalance, monthTransactions);
    previousEnding = summary.endingBalance;

    result = {
      monthStart,
      startingBalance,
      startingBalanceSource: source,
      previousMonthEndingBalance: priorEnding,
      transactions: calculatedTransactions,
      summary,
    };
  }

  return result!;
}

export interface MonthCalculationResult {
  monthStart: string;
  startingBalance: number | null;
  startingBalanceSource: "initial" | "previous_month" | "override" | "untracked";
  previousMonthEndingBalance: number | null;
  transactions: CalculatedTransaction[];
  summary: MonthlySummary | null;
}

function addMonths(monthStart: string, amount: number): string {
  const date = new Date(`${monthStart}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7) + "-01";
}
