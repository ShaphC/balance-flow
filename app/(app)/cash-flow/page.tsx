import { createClient } from "@/lib/supabase/server";
import { calculateMonthChain } from "@/lib/finance/balances";
import { getCurrentMonthKey } from "@/lib/dates";
import type {
  BalanceAnchor,
  BalanceOverride,
  Transaction,
} from "@/types/finance";
import { CashFlowClient } from "@/components/cash-flow/cash-flow-client";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;

  const month =
    params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : getCurrentMonthKey();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    return (
      <CashFlowClient month={month} calculation={null} hasAccount={false} />
    );
  }

  const { data: anchorRow } = await supabase
    .from("balance_anchors")
    .select("id,account_id,initial_date,initial_balance,status")
    .eq("account_id", account.id)
    .single();

  if (!anchorRow) {
    return (
      <CashFlowClient month={month} calculation={null} hasAccount={true} />
    );
  }

  const anchor: BalanceAnchor = {
    id: anchorRow.id,
    accountId: anchorRow.account_id,
    initialDate: anchorRow.initial_date,
    initialBalance: Number(anchorRow.initial_balance),
    status: anchorRow.status,
  };

  const endDate = lastDayOfMonth(month);

  const { data: transactionRows } = await supabase
    .from("transactions")
    .select(
      "id,account_id,user_id,recurring_rule_id,name,amount,transaction_date,sort_order",
    )
    .eq("account_id", account.id)
    .gte("transaction_date", anchor.initialDate)
    .lte("transaction_date", endDate)
    .order("transaction_date", { ascending: true })
    .order("sort_order", { ascending: true });

  const { data: overrideRows } = await supabase
    .from("monthly_balance_overrides")
    .select("id,account_id,user_id,month_start,starting_balance")
    .eq("account_id", account.id)
    .lte("month_start", `${month}-01`);

  const transactions: Transaction[] = (transactionRows ?? []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    recurringRuleId: row.recurring_rule_id,
    name: row.name,
    amount: Number(row.amount),
    transactionDate: row.transaction_date,
    sortOrder: row.sort_order,
  }));

  const overrides: BalanceOverride[] = (overrideRows ?? []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    userId: row.user_id,
    monthStart: row.month_start,
    startingBalance: Number(row.starting_balance),
  }));

  const calculation = calculateMonthChain(
    anchor,
    transactions,
    overrides,
    `${month}-01`,
  );

  return <CashFlowClient month={month} calculation={calculation} hasAccount />;
}

function lastDayOfMonth(month: string): string {
  const date = new Date(`${month}-01T12:00:00Z`);

  date.setUTCMonth(date.getUTCMonth() + 1, 0);

  return date.toISOString().slice(0, 10);
}
