"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  LockKeyhole,
  Link2,
  Unlink2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import {
  createCashFlowSetup,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  reconnectStartingBalance,
  updateStartingBalance,
} from "@/app/(app)/cash-flow/actions";

import type { MonthCalculationResult } from "@/lib/finance/balances";

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function money(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function maskedMoney(value: number) {
  const seed = (Math.abs(Math.round(value * 97)) % 9000) + 1000;
  return money(seed / 1.37);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00`));
}

function parseAmount(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInputAmount(value: string) {
  if (!value.trim()) return "";

  const number = parseAmount(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return number.toFixed(2);
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export function CashFlowClient({
  month,
  calculation,
  hasAccount,
}: {
  month: string;
  calculation: MonthCalculationResult | null;
  hasAccount: boolean;
}) {
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [privacy, setPrivacy] = useState(false);

  const [showSetup, setShowSetup] = useState(!hasAccount);
  const [showAdd, setShowAdd] = useState(false);

  const [editing, setEditing] = useState<
    MonthCalculationResult["transactions"][number] | null
  >(null);

  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Month Navigation                                                         */
  /* ------------------------------------------------------------------------ */

  const goMonth = (delta: number) => {
    const date = new Date(`${month}-01T12:00:00`);

    date.setUTCMonth(date.getUTCMonth() + delta);

    const next = date.toISOString().slice(0, 7);

    router.push(`/cash-flow?month=${next}`);
  };

  /* ------------------------------------------------------------------------ */
  /* Server Action Runner                                                     */
  /* ------------------------------------------------------------------------ */

  const run = (fn: () => Promise<unknown>) => {
    setError(null);

    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };

  /* ------------------------------------------------------------------------ */
  /* Derived State                                                            */
  /* ------------------------------------------------------------------------ */

  const summary = calculation?.summary;
  const isOverride = calculation?.startingBalanceSource === "override";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 sm:px-6 sm:py-8">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <header className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-[var(--muted-foreground)]">Cash Flow</p>

            {privacy && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 text-[11px] font-medium">
                <LockKeyhole size={12} />
                Privacy Mode
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              className="shrink-0 px-2"
              aria-label="Previous month"
              onClick={() => goMonth(-1)}
            >
              <ChevronLeft size={20} />
            </Button>

            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-3xl">
              {monthLabel(month)}
            </h1>

            <Button
              variant="ghost"
              className="shrink-0 px-2"
              aria-label="Next month"
              onClick={() => goMonth(1)}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </div>

        <Button
          variant={privacy ? "default" : "outline"}
          className="w-full sm:w-auto"
          onClick={() => setPrivacy((value) => !value)}
        >
          <LockKeyhole size={16} className="mr-2" />
          {privacy ? "Privacy On" : "Privacy Mode"}
        </Button>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Error                                                              */}
      {/* ------------------------------------------------------------------ */}

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Initial Setup                                                       */}
      {/* ------------------------------------------------------------------ */}

      {!hasAccount || showSetup ? (
        <SetupCard
          initialDate={`${month}-01`}
          pending={pending}
          onCancel={hasAccount ? () => setShowSetup(false) : undefined}
          onSubmit={(initialDate, initialBalance) =>
            run(() =>
              createCashFlowSetup({
                initialDate,
                initialBalance,
              }).then(() => setShowSetup(false)),
            )
          }
        />
      ) : calculation && summary ? (
        <>
          {/* -------------------------------------------------------------- */}
          {/* Summary                                                         */}
          {/* -------------------------------------------------------------- */}

          <Card className="mb-5 overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
              <Metric
                label="Starting Balance"
                value={calculation.startingBalance ?? 0}
                privacy={privacy}
              />

              <Metric
                label="Income"
                value={summary.totalIncome}
                privacy={privacy}
              />

              <Metric
                label="Expenses"
                value={-summary.totalExpenses}
                privacy={privacy}
              />

              <Metric
                label="Ending Balance"
                value={summary.endingBalance}
                privacy={privacy}
                strong
              />
            </div>

            {isOverride && (
              <div className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <Unlink2 size={16} className="mt-0.5 shrink-0" />

                  <span>
                    This month's starting balance is intentionally disconnected
                    from the previous month's ending balance.
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={pending}
                  onClick={() =>
                    run(() => reconnectStartingBalance(`${month}-01`))
                  }
                >
                  <Link2 size={15} className="mr-2" />
                  Reconnect
                </Button>
              </div>
            )}
          </Card>

          {/* -------------------------------------------------------------- */}
          {/* Transactions Header                                             */}
          {/* -------------------------------------------------------------- */}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Transactions</p>

              {calculation.startingBalanceSource === "previous_month" && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Starting balance comes from the previous month.
                </p>
              )}

              {calculation.startingBalanceSource === "initial" && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  This is your original starting balance.
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setShowBalanceEditor(true)}
              >
                <Pencil size={15} className="mr-2" />
                Starting balance
              </Button>

              <Button
                className="w-full sm:w-auto"
                onClick={() => setShowAdd(true)}
              >
                <Plus size={16} className="mr-2" />
                Add transaction
              </Button>
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Transactions Table                                              */}
          {/* -------------------------------------------------------------- */}

          <Card className="overflow-hidden">
            {/* Desktop header only */}
            <div className="hidden grid-cols-[120px_1fr_130px_100px_88px] gap-3 border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--muted-foreground)] sm:grid">
              <span>Balance</span>
              <span>Name</span>
              <span>Amount</span>
              <span className="text-right">Date</span>
              <span />
            </div>

            <div className="divide-y divide-[var(--border)]">
              <StartingRow
                value={calculation.startingBalance ?? 0}
                privacy={privacy}
                date={calculation.monthStart}
              />

              {calculation.transactions.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
                  No transactions yet. Add your first income or expense.
                </div>
              ) : (
                calculation.transactions.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    privacy={privacy}
                    pending={pending}
                    onDelete={() =>
                      run(() => deleteTransaction(transaction.id))
                    }
                    onEdit={() => setEditing(transaction)}
                  />
                ))
              )}
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center">
          <p className="font-medium">This month is not being tracked yet.</p>

          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Go to your first tracking month to establish a starting balance.
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Add Transaction                                                     */}
      {/* ------------------------------------------------------------------ */}

      {showAdd && (
        <TransactionDialog
          month={month}
          pending={pending}
          onClose={() => setShowAdd(false)}
          onSubmit={(input) =>
            run(() => createTransaction(input).then(() => setShowAdd(false)))
          }
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Edit Transaction                                                    */}
      {/* ------------------------------------------------------------------ */}

      {editing && (
        <TransactionDialog
          month={month}
          transaction={editing}
          pending={pending}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            run(() => updateTransaction(input).then(() => setEditing(null)))
          }
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Starting Balance                                                    */}
      {/* ------------------------------------------------------------------ */}

      {showBalanceEditor && calculation && summary && (
        <BalanceDialog
          month={month}
          current={calculation.startingBalance ?? 0}
          pending={pending}
          isInitialBalance={calculation.startingBalanceSource === "initial"}
          onClose={() => setShowBalanceEditor(false)}
          onSubmit={(value) =>
            run(() =>
              updateStartingBalance({
                monthStart: `${month}-01`,
                startingBalance: value,
              }).then(() => setShowBalanceEditor(false)),
            )
          }
        />
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Metric                                                                     */
/* -------------------------------------------------------------------------- */

function Metric({
  label,
  value,
  privacy,
  strong = false,
}: {
  label: string;
  value: number;
  privacy: boolean;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0 bg-[var(--card)] p-3 sm:p-5">
      <p className="truncate text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-lg ${
          strong ? "font-semibold sm:text-2xl" : "font-medium sm:text-xl"
        }`}
      >
        {privacy ? maskedMoney(value) : money(value)}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Starting Row                                                               */
/* -------------------------------------------------------------------------- */

function StartingRow({
  value,
  privacy,
  date,
}: {
  value: number;
  privacy: boolean;
  date: string;
}) {
  return (
    <div className="grid gap-2 px-4 py-4 sm:grid-cols-[120px_1fr_130px_100px_88px] sm:items-center sm:gap-3">
      <div className="text-base font-semibold">
        {privacy ? maskedMoney(value) : money(value)}
      </div>

      <div className="font-medium">Starting Balance</div>

      <div className="text-sm font-medium">
        {privacy ? maskedMoney(value) : money(value)}
      </div>

      <div className="text-sm text-[var(--muted-foreground)] sm:text-right">
        {formatDate(date)}
      </div>

      <div />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Transaction Row                                                            */
/* -------------------------------------------------------------------------- */

function TransactionRow({
  transaction,
  privacy,
  pending,
  onDelete,
  onEdit,
}: {
  transaction: MonthCalculationResult["transactions"][number];
  privacy: boolean;
  pending: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[120px_1fr_130px_100px_88px] sm:items-center sm:gap-3">
      {/* Balance */}
      <div className="text-base font-semibold">
        {privacy
          ? maskedMoney(transaction.runningBalance)
          : money(transaction.runningBalance)}
      </div>

      {/* Name */}
      <div className="min-w-0 break-words font-medium">
        {privacy ? "Private transaction" : transaction.name}
      </div>

      {/* Amount */}
      <div
        className={`font-medium ${
          transaction.amount < 0
            ? "text-red-600 dark:text-red-300"
            : "text-emerald-700 dark:text-emerald-300"
        }`}
      >
        {privacy
          ? maskedMoney(transaction.amount)
          : `${transaction.amount > 0 ? "+" : "-"}${money(
              Math.abs(transaction.amount),
            )}`}
      </div>

      {/* Date + actions */}
      <div className="flex items-center justify-between gap-3 sm:contents">
        <div className="text-sm text-[var(--muted-foreground)] sm:text-right">
          {formatDate(transaction.transactionDate)}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={pending}
            onClick={onEdit}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-black/5 hover:text-red-600 dark:hover:bg-white/5"
            aria-label={`Edit ${transaction.name}`}
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-black/5 hover:text-red-600 dark:hover:bg-white/5"
            aria-label={`Delete ${transaction.name}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Setup Card                                                                 */
/* -------------------------------------------------------------------------- */

function SetupCard({
  initialDate,
  pending,
  onSubmit,
  onCancel,
}: {
  initialDate: string;
  pending: boolean;
  onSubmit: (date: string, balance: number) => void;
  onCancel?: () => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [balance, setBalance] = useState("");

  const handleBalanceChange = (value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setBalance(value);
    }
  };

  const handleBalanceFocus = () => {
    if (balance === "0.00") {
      setBalance("");
    }
  };

  const handleBlur = () => {
    if (!balance.trim()) return;

    setBalance(formatInputAmount(balance));
  };

  return (
    <Card className="mb-6 max-w-xl p-5 sm:p-6">
      <p className="text-sm font-medium text-[var(--muted-foreground)]">
        Get started
      </p>

      <h2 className="mt-1 text-xl font-semibold">
        Set your first starting balance
      </h2>

      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        This becomes the anchor for your Cash Flow timeline. Future months will
        roll forward automatically.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          First tracking month
          <input
            className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div>
          <label className="text-sm font-medium">Starting balance</label>

          <div className="mt-2 flex h-11 items-center rounded-xl border border-[var(--border)] bg-transparent px-3 focus-within:ring-2 focus-within:ring-[var(--ring)]">
            <span className="mr-2 text-sm font-medium text-[var(--muted-foreground)]">
              $
            </span>

            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
              type="text"
              inputMode="decimal"
              value={balance}
              placeholder="0.00"
              onFocus={handleBalanceFocus}
              onChange={(e) => handleBalanceChange(e.target.value)}
              onBlur={handleBlur}
              aria-label="Starting balance in Canadian dollars"
            />

            <span className="ml-2 text-xs font-medium text-[var(--muted-foreground)]">
              CAD
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}

        <Button
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={() => onSubmit(date, parseAmount(balance))}
        >
          Save starting balance
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Transaction Dialog                                                         */
/* -------------------------------------------------------------------------- */

function TransactionDialog({
  month,
  transaction,
  pending,
  onClose,
  onSubmit,
}: {
  month: string;
  transaction?: MonthCalculationResult["transactions"][number];
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: unknown) => void;
}) {
  const [name, setName] = useState(transaction?.name ?? "");

  const [amount, setAmount] = useState(
    transaction ? Math.abs(transaction.amount).toFixed(2) : "",
  );

  const [date, setDate] = useState(
    transaction?.transactionDate ?? `${month}-01`,
  );

  const [type, setType] = useState<"income" | "expense">(
    transaction && transaction.amount > 0 ? "income" : "expense",
  );

  const handleAmountChange = (value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  const handleAmountFocus = () => {
    if (amount === "0.00") {
      setAmount("");
    }
  };

  const handleAmountBlur = () => {
    if (!amount.trim()) return;

    setAmount(formatInputAmount(amount));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--muted-foreground)]">
              Cash Flow
            </p>

            <h2 className="text-xl font-semibold">
              {transaction ? "Edit transaction" : "Add transaction"}
            </h2>
          </div>

          <Button variant="ghost" className="shrink-0" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Type */}

          <label className="block text-sm font-medium">
            Type
            <select
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
              value={type}
              onChange={(e) => setType(e.target.value as "income" | "expense")}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>

          {/* Name */}

          <label className="block text-sm font-medium">
            Name
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rent"
            />
          </label>

          {/* Amount */}

          <div>
            <label className="block text-sm font-medium">Amount</label>

            <div className="mt-2 flex h-11 items-center rounded-xl border border-[var(--border)] bg-transparent px-3 focus-within:ring-2 focus-within:ring-[var(--ring)]">
              <span className="mr-2 text-sm font-medium text-[var(--muted-foreground)]">
                $
              </span>

              <input
                className="h-full min-w-0 flex-1 bg-transparent outline-none"
                type="text"
                inputMode="decimal"
                value={amount}
                placeholder="0.00"
                onFocus={handleAmountFocus}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={handleAmountBlur}
                aria-label="Transaction amount in Canadian dollars"
              />

              <span className="ml-2 text-xs font-medium text-[var(--muted-foreground)]">
                CAD
              </span>
            </div>

            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
              {type === "expense"
                ? "This will be recorded as a negative cash-flow amount."
                : "This will be recorded as a positive cash-flow amount."}
            </span>
          </div>

          {/* Date */}

          <label className="block text-sm font-medium">
            Date
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            className="w-full sm:w-auto"
            disabled={pending || !name.trim() || parseAmount(amount) <= 0}
            onClick={() =>
              onSubmit(
                transaction
                  ? {
                      id: transaction.id,
                      name,
                      amount: parseAmount(amount),
                      transactionDate: date,
                      type,
                      recurrence: "once",
                    }
                  : {
                      name,
                      amount: parseAmount(amount),
                      transactionDate: date,
                      type,
                      recurrence: "once",
                    },
              )
            }
          >
            {transaction ? "Save changes" : "Add transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Balance Dialog                                                             */
/* -------------------------------------------------------------------------- */

function BalanceDialog({
  month,
  current,
  pending,
  isInitialBalance,
  onClose,
  onSubmit,
}: {
  month: string;
  current: number;
  pending: boolean;
  isInitialBalance: boolean;
  onClose: () => void;
  onSubmit: (value: number) => void;
}) {
  const [value, setValue] = useState(current === 0 ? "" : current.toFixed(2));

  const handleChange = (input: string) => {
    if (/^\d*\.?\d{0,2}$/.test(input)) {
      setValue(input);
    }
  };

  const handleFocus = () => {
    if (value === "0.00") {
      setValue("");
    }
  };

  const handleBlur = () => {
    if (!value.trim()) return;

    setValue(formatInputAmount(value));
  };

  const handleSubmit = () => {
    onSubmit(parseAmount(value));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl sm:rounded-3xl">
        <div>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            Cash Flow
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            {isInitialBalance ? "Set starting balance" : "Starting balance"}
          </h2>
        </div>

        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {isInitialBalance
            ? `Set the starting balance for ${monthLabel(
                month,
              )}. Future months will roll forward from this balance.`
            : `Changing this creates an intentional override for ${monthLabel(
                month,
              )}. You can reconnect it to the previous month's ending balance afterward.`}
        </p>

        <div className="mt-5">
          <label className="block text-sm font-medium">Starting balance</label>

          <div className="mt-2 flex h-11 items-center rounded-xl border border-[var(--border)] bg-transparent px-3 focus-within:ring-2 focus-within:ring-[var(--ring)]">
            <span className="mr-2 text-sm font-medium text-[var(--muted-foreground)]">
              $
            </span>

            <input
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
              type="text"
              inputMode="decimal"
              value={value}
              placeholder="0.00"
              onFocus={handleFocus}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              aria-label="Starting balance in Canadian dollars"
              autoFocus
            />

            <span className="ml-2 text-xs font-medium text-[var(--muted-foreground)]">
              CAD
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          <Button
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={handleSubmit}
          >
            {isInitialBalance ? "Save starting balance" : "Save override"}
          </Button>
        </div>
      </div>
    </div>
  );
}
