"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
  GripVertical,
  ChevronUp,
  ChevronDown,
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
  reorderTransactions,
  moveTransaction,
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

function formatDateLong(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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

  const [orderedTransactions, setOrderedTransactions] = useState<
    MonthCalculationResult["transactions"]
  >(calculation?.transactions ?? []);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  /*
   * Keep track of the date group being dragged.
   *
   * This is important because reorderTransactions only accepts transactions
   * from the same date.
   */
  const draggingDateRef = useRef<string | null>(null);

  const dragPointerId = useRef<number | null>(null);

  /* ------------------------------------------------------------------------ */
  /* Sync Local Transaction Order                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    setOrderedTransactions(calculation?.transactions ?? []);
  }, [calculation?.transactions]);

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
  /* Reorder Persistence                                                      */
  /* ------------------------------------------------------------------------ */

  const persistOrder = (
    transactions: MonthCalculationResult["transactions"],
    date: string,
  ) => {
    /*
     * IMPORTANT:
     *
     * reorderTransactions only accepts transactions sharing the same date.
     *
     * Only send the reordered date group here.
     */
    const sameDateTransactions = transactions.filter(
      (transaction) => transaction.transactionDate === date,
    );

    const ids = sameDateTransactions.map((transaction) => transaction.id);

    if (ids.length <= 1) {
      return;
    }

    run(() => reorderTransactions({ transactionIds: ids }));
  };

  /* ------------------------------------------------------------------------ */
  /* Move Transaction                                                         */
  /* ------------------------------------------------------------------------ */

  const handleMove = (transactionId: string, direction: "up" | "down") => {
    if (pending) return;

    const currentIndex = orderedTransactions.findIndex(
      (transaction) => transaction.id === transactionId,
    );

    if (currentIndex === -1) return;

    const current = orderedTransactions[currentIndex];

    const candidateIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (candidateIndex < 0 || candidateIndex >= orderedTransactions.length) {
      return;
    }

    const candidate = orderedTransactions[candidateIndex];

    /*
     * A transaction can only move within its own date group.
     */
    if (candidate.transactionDate !== current.transactionDate) {
      return;
    }

    const next = [...orderedTransactions];

    [next[currentIndex], next[candidateIndex]] = [
      next[candidateIndex],
      next[currentIndex],
    ];

    setOrderedTransactions(next);

    run(() =>
      moveTransaction({
        transactionId,
        direction,
      }),
    );
  };

  /* ------------------------------------------------------------------------ */
  /* Drag Helpers                                                             */
  /* ------------------------------------------------------------------------ */

  const moveLocalTransaction = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return orderedTransactions;
    }

    const sourceIndex = orderedTransactions.findIndex(
      (transaction) => transaction.id === sourceId,
    );

    const targetIndex = orderedTransactions.findIndex(
      (transaction) => transaction.id === targetId,
    );

    if (sourceIndex === -1 || targetIndex === -1) {
      return orderedTransactions;
    }

    const source = orderedTransactions[sourceIndex];
    const target = orderedTransactions[targetIndex];

    /*
     * Never allow a drag to cross a date boundary.
     */
    if (source.transactionDate !== target.transactionDate) {
      return orderedTransactions;
    }

    const next = [...orderedTransactions];

    const [moved] = next.splice(sourceIndex, 1);

    const newTargetIndex = next.findIndex(
      (transaction) => transaction.id === targetId,
    );

    if (newTargetIndex === -1) {
      return orderedTransactions;
    }

    next.splice(newTargetIndex, 0, moved);

    return next;
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    transactionId: string,
  ) => {
    if (pending) return;

    event.preventDefault();

    const transaction = orderedTransactions.find(
      (item) => item.id === transactionId,
    );

    if (!transaction) return;

    dragPointerId.current = event.pointerId;
    draggingDateRef.current = transaction.transactionDate;

    event.currentTarget.setPointerCapture(event.pointerId);

    setDraggingId(transactionId);
    setDragOverId(transactionId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingId === null || dragPointerId.current !== event.pointerId) {
      return;
    }

    const element = document.elementFromPoint(event.clientX, event.clientY);

    const row = element?.closest<HTMLElement>("[data-transaction-id]");

    const targetId = row?.dataset.transactionId;

    if (!targetId || targetId === draggingId) {
      return;
    }

    const source = orderedTransactions.find(
      (transaction) => transaction.id === draggingId,
    );

    const target = orderedTransactions.find(
      (transaction) => transaction.id === targetId,
    );

    if (!source || !target) {
      return;
    }

    /*
     * Keep the drag locked to the original date.
     */
    if (
      draggingDateRef.current === null ||
      source.transactionDate !== draggingDateRef.current ||
      target.transactionDate !== draggingDateRef.current
    ) {
      return;
    }

    const next = moveLocalTransaction(draggingId, targetId);

    if (next !== orderedTransactions) {
      setOrderedTransactions(next);
      setDragOverId(targetId);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingId === null || dragPointerId.current !== event.pointerId) {
      return;
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released.
    }

    const finalOrder = orderedTransactions;
    const dragDate = draggingDateRef.current;

    setDraggingId(null);
    setDragOverId(null);
    dragPointerId.current = null;
    draggingDateRef.current = null;

    /*
     * Only persist the date group that was actually dragged.
     */
    if (dragDate && finalOrder.length > 0) {
      persistOrder(finalOrder, dragDate);
    }
  };

  const handlePointerCancel = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already have been released.
    }

    setDraggingId(null);
    setDragOverId(null);

    dragPointerId.current = null;
    draggingDateRef.current = null;

    /*
     * Re-sync from the server calculation if a drag is cancelled.
     */
    setOrderedTransactions(calculation?.transactions ?? []);
  };

  /* ------------------------------------------------------------------------ */
  /* Derived State                                                            */
  /* ------------------------------------------------------------------------ */

  const summary = calculation?.summary;
  const isOverride = calculation?.startingBalanceSource === "override";

  /*
   * Build date groups while preserving the current transaction order.
   *
   * Transactions are expected to already be ordered by date and then by
   * their custom order within that date.
   */
  const transactionGroups = orderedTransactions.reduce<
    {
      date: string;
      transactions: MonthCalculationResult["transactions"];
    }[]
  >((groups, transaction) => {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.date === transaction.transactionDate) {
      lastGroup.transactions.push(transaction);
    } else {
      groups.push({
        date: transaction.transactionDate,
        transactions: [transaction],
      });
    }

    return groups;
  }, []);

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

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            </div>
          )}

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

              {orderedTransactions.length > 1 && (
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Drag transactions using the handle, or use the arrows to
                  reorder transactions on the same date.
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
          {/* Transactions                                                     */}
          {/* -------------------------------------------------------------- */}

          <Card className="border-0 bg-transparent shadow-none">
            <StartingRow
              value={calculation.startingBalance ?? 0}
              privacy={privacy}
              date={calculation.monthStart}
            />

            {orderedTransactions.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">
                No transactions yet. Add your first income or expense.
              </div>
            ) : (
              <div className="space-y-6">
                {transactionGroups.map((group) => (
                  <TransactionDateGroup
                    key={group.date}
                    date={group.date}
                    transactions={group.transactions}
                    privacy={privacy}
                    pending={pending}
                    draggingId={draggingId}
                    dragOverId={dragOverId}
                    orderedTransactions={orderedTransactions}
                    onDelete={(transactionId) =>
                      run(() => deleteTransaction(transactionId))
                    }
                    onEdit={(transaction) => setEditing(transaction)}
                    onMoveUp={(transactionId) =>
                      handleMove(transactionId, "up")
                    }
                    onMoveDown={(transactionId) =>
                      handleMove(transactionId, "down")
                    }
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                  />
                ))}
              </div>
            )}
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
    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
      <p className="truncate text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </p>

      <p
        className={`mt-1 truncate ${
          strong
            ? "text-xl font-semibold sm:text-2xl"
            : "text-lg font-medium sm:text-xl"
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
    <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[32px_120px_130px_minmax(0,1fr)_112px_80px] sm:items-center sm:gap-3">
        {/* Empty drag-handle column */}

        <div className="hidden sm:block" />

        {/* Starting balance / running balance */}

        <div className="min-w-0 text-base font-semibold">
          {privacy ? maskedMoney(value) : money(value)}
        </div>

        {/* Empty income / expense amount column */}

        <div className="hidden sm:block" />

        {/* Name */}

        <div className="col-span-2 min-w-0 font-medium sm:col-span-1">
          Starting Balance
        </div>

        {/* Date */}

        <div className="min-w-0 whitespace-nowrap text-sm text-[var(--muted-foreground)] sm:text-left">
          {formatDate(date)}
        </div>

        {/* Empty actions column */}

        <div className="hidden sm:block" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Transaction Date Group                                                     */
/* -------------------------------------------------------------------------- */

function TransactionDateGroup({
  date,
  transactions,
  privacy,
  pending,
  draggingId,
  dragOverId,
  orderedTransactions,
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  date: string;
  transactions: MonthCalculationResult["transactions"];
  privacy: boolean;
  pending: boolean;
  draggingId: string | null;
  dragOverId: string | null;
  orderedTransactions: MonthCalculationResult["transactions"];
  onDelete: (transactionId: string) => void;
  onEdit: (transaction: MonthCalculationResult["transactions"][number]) => void;
  onMoveUp: (transactionId: string) => void;
  onMoveDown: (transactionId: string) => void;
  onPointerDown: (
    event: React.PointerEvent<HTMLButtonElement>,
    transactionId: string,
  ) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section>
      {/* Date Heading */}

      <div className="mb-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />

        <div className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--muted-foreground)]">
          {formatDateLong(date)}
        </div>

        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {/* Transactions belonging to this date */}

      <div className="space-y-2">
        {transactions.map((transaction) => {
          const currentIndex = orderedTransactions.findIndex(
            (item) => item.id === transaction.id,
          );

          const previous = orderedTransactions[currentIndex - 1];
          const next = orderedTransactions[currentIndex + 1];

          const canMoveUp =
            Boolean(previous) &&
            previous.transactionDate === transaction.transactionDate;

          const canMoveDown =
            Boolean(next) &&
            next.transactionDate === transaction.transactionDate;

          return (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              privacy={privacy}
              pending={pending}
              dragging={draggingId === transaction.id}
              dragOver={dragOverId === transaction.id}
              onDelete={() => onDelete(transaction.id)}
              onEdit={() => onEdit(transaction)}
              onMoveUp={() => onMoveUp(transaction.id)}
              onMoveDown={() => onMoveDown(transaction.id)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
            />
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Transaction Row                                                            */
/* -------------------------------------------------------------------------- */

function TransactionRow({
  transaction,
  privacy,
  pending,
  dragging,
  dragOver,
  onDelete,
  onEdit,
  onMoveUp,
  onMoveDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  canMoveUp,
  canMoveDown,
}: {
  transaction: MonthCalculationResult["transactions"][number];
  privacy: boolean;
  pending: boolean;
  dragging: boolean;
  dragOver: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPointerDown: (
    event: React.PointerEvent<HTMLButtonElement>,
    transactionId: string,
  ) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div
      data-transaction-id={transaction.id}
      className={[
        "relative rounded-2xl border bg-[var(--card)] px-3 py-3 transition-all sm:px-4 sm:py-4",
        dragging
          ? "scale-[1.01] opacity-60 shadow-lg"
          : "border-[var(--border)]",
        dragOver && !dragging
          ? "border-[var(--foreground)] ring-1 ring-[var(--foreground)]/20"
          : "",
      ].join(" ")}
    >
      <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[32px_120px_130px_minmax(0,1fr)_80px] sm:items-center sm:gap-3">
        {/* -------------------------------------------------------------- */}
        {/* Drag Handle                                                     */}
        {/* -------------------------------------------------------------- */}

        <div className="flex items-center justify-start sm:justify-center">
          <button
            type="button"
            disabled={pending}
            aria-label={`Drag ${transaction.name}`}
            title="Drag to reorder"
            onPointerDown={(event) => onPointerDown(event, transaction.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className="flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical size={18} />
          </button>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Running Balance                                                 */}
        {/* -------------------------------------------------------------- */}

        <div className="min-w-0 text-base font-semibold">
          {privacy
            ? maskedMoney(transaction.runningBalance)
            : money(transaction.runningBalance)}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Income / Expense Amount                                         */}
        {/* -------------------------------------------------------------- */}

        <div
          className={`min-w-0 font-medium ${
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

        {/* -------------------------------------------------------------- */}
        {/* Name                                                             */}
        {/* -------------------------------------------------------------- */}

        <div className="col-span-2 min-w-0 break-words font-medium sm:col-span-1">
          {privacy ? "Private transaction" : transaction.name}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Reorder + Edit/Delete                                            */}
        {/* -------------------------------------------------------------- */}

        <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
          {/* Up / Down */}

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={pending || !canMoveUp}
              onClick={onMoveUp}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Move ${transaction.name} up`}
              title="Move up"
            >
              <ChevronUp size={16} />
            </button>

            <button
              type="button"
              disabled={pending || !canMoveDown}
              onClick={onMoveDown}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Move ${transaction.name} down`}
              title="Move down"
            >
              <ChevronDown size={16} />
            </button>
          </div>

          {/* Edit / Delete */}

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={pending}
              onClick={onEdit}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Edit ${transaction.name}`}
              title="Edit"
            >
              <Pencil size={16} />
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-muted hover:text-red-600"
              aria-label={`Delete ${transaction.name}`}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
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

          <label className="block text-sm font-medium">
            Name
            <input
              className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-transparent px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rent"
            />
          </label>

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
