export type TransactionType = "income" | "expense";
export type RecurrenceFrequency = "once" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface Transaction {
  id: string;
  accountId: string;
  userId: string;
  recurringRuleId?: string | null;
  name: string;
  amount: number;
  transactionDate: string;
  sortOrder: number;
}

export interface BalanceAnchor {
  id: string;
  accountId: string;
  initialDate: string;
  initialBalance: number;
  status: "connected" | "overridden";
}

export interface BalanceOverride {
  id: string;
  accountId: string;
  userId: string;
  monthStart: string;
  startingBalance: number;
}

export interface MonthlySummary {
  startingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  endingBalance: number;
}

export interface CalculatedTransaction extends Transaction {
  runningBalance: number;
}

export interface MonthCalculation {
  monthStart: string;
  startingBalance: number | null;
  startingBalanceSource: "initial" | "previous_month" | "override" | "untracked";
  previousMonthEndingBalance: number | null;
  transactions: CalculatedTransaction[];
  summary: MonthlySummary | null;
}
