"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validation/finance";
import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const setupSchema = z.object({
  initialDate: z.string().date(),
  initialBalance: z.number().finite(),
});

const updateBalanceSchema = z.object({
  monthStart: z.string().date(),
  startingBalance: z.number().finite(),
});

const idSchema = z.string().uuid();

const reorderTransactionsSchema = z.object({
  transactionIds: z.array(idSchema).min(1),
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Converts either:
 *
 * YYYY-MM
 * YYYY-MM-DD
 *
 * into a full ISO date:
 *
 * YYYY-MM-01
 * YYYY-MM-DD
 */
function normalizeMonthStart(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return `${value}-01`;
  }

  return value;
}

async function getUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

/* -------------------------------------------------------------------------- */
/* Cash Flow Setup                                                            */
/* -------------------------------------------------------------------------- */

export async function createCashFlowSetup(input: unknown) {
  const parsed = setupSchema.parse(input);

  const { supabase, user } = await getUser();

  const { data: existing } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true };
  }

  const { data: account, error: accountError } = await supabase
    .from("financial_accounts")
    .insert({
      user_id: user.id,
      name: "Personal Cash Flow",
    })
    .select("id")
    .single();

  if (accountError) {
    throw new Error(accountError.message);
  }

  const { error: anchorError } = await supabase.from("balance_anchors").insert({
    account_id: account.id,
    user_id: user.id,
    initial_date: parsed.initialDate,
    initial_balance: parsed.initialBalance,
    status: "connected",
  });

  if (anchorError) {
    throw new Error(anchorError.message);
  }

  revalidatePath("/cash-flow");

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Create Transaction                                                         */
/* -------------------------------------------------------------------------- */

export async function createTransaction(input: unknown) {
  const parsed = transactionSchema.parse(input);

  const { supabase, user } = await getUser();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Set up your Cash Flow before adding transactions.");
  }

  const { data: sameDay } = await supabase
    .from("transactions")
    .select("sort_order")
    .eq("account_id", account.id)
    .eq("transaction_date", parsed.transactionDate)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder =
    sameDay?.[0]?.sort_order != null ? sameDay[0].sort_order + 1000 : 1000;

  const signedAmount =
    parsed.type === "expense"
      ? -Math.abs(parsed.amount)
      : Math.abs(parsed.amount);

  const { error } = await supabase.from("transactions").insert({
    account_id: account.id,
    user_id: user.id,
    name: parsed.name,
    amount: signedAmount,
    transaction_date: parsed.transactionDate,
    sort_order: nextSortOrder,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-flow");

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Update Transaction                                                         */
/* -------------------------------------------------------------------------- */

export async function updateTransaction(input: unknown) {
  const parsed = transactionSchema.extend({ id: idSchema }).parse(input);

  const { supabase, user } = await getUser();

  const signedAmount =
    parsed.type === "expense"
      ? -Math.abs(parsed.amount)
      : Math.abs(parsed.amount);

  const { error } = await supabase
    .from("transactions")
    .update({
      name: parsed.name,
      amount: signedAmount,
      transaction_date: parsed.transactionDate,
    })
    .eq("id", parsed.id)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-flow");

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Toggle Transaction Processed                                               */
/* -------------------------------------------------------------------------- */

export async function toggleTransactionProcessed(input: unknown) {
  const parsed = z
    .object({
      transactionId: idSchema,
      processed: z.boolean(),
    })
    .parse(input);

  const { supabase, user } = await getUser();

  const { error } = await supabase
    .from("transactions")
    .update({
      processed: parsed.processed,
    })
    .eq("id", parsed.transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-flow");

  return {
    ok: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Delete Transaction                                                         */
/* -------------------------------------------------------------------------- */

export async function deleteTransaction(id: string) {
  const transactionId = idSchema.parse(id);

  const { supabase, user } = await getUser();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/cash-flow");

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Reorder Transactions                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Persists the visible transaction order.
 *
 * Transaction dates remain authoritative for chronological ordering.
 * sort_order controls the order of transactions that share the same date.
 *
 * The client sends the complete ordered list for the current month's
 * transactions. We validate ownership before changing anything.
 */
export async function reorderTransactions(input: unknown) {
  const parsed = reorderTransactionsSchema.parse(input);

  const { supabase, user } = await getUser();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Cash Flow account not found.");
  }

  const uniqueIds = [...new Set(parsed.transactionIds)];

  if (uniqueIds.length !== parsed.transactionIds.length) {
    throw new Error("Invalid transaction order.");
  }

  const { data: transactions, error: fetchError } = await supabase
    .from("transactions")
    .select("id, transaction_date")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .in("id", uniqueIds);

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!transactions || transactions.length !== uniqueIds.length) {
    throw new Error("One or more transactions could not be found.");
  }

  /*
   * A transaction's date is intentionally handled separately from its
   * sort_order. Reordering is only valid among transactions sharing the
   * same date.
   */
  const dates = new Set(
    transactions.map((transaction) => transaction.transaction_date),
  );

  if (dates.size > 1) {
    throw new Error(
      "Transactions can only be reordered when they have the same date.",
    );
  }

  /*
   * Use spaced sort values so future inserts can still fit between
   * existing transactions without requiring constant renumbering.
   */
  for (let index = 0; index < uniqueIds.length; index += 1) {
    const { error } = await supabase
      .from("transactions")
      .update({
        sort_order: (index + 1) * 1000,
      })
      .eq("id", uniqueIds[index])
      .eq("account_id", account.id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/cash-flow");

  return {
    ok: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Move Transaction                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Convenience action for the arrow controls.
 *
 * This uses the same persisted ordering mechanism as drag-and-drop.
 */
export async function moveTransaction(input: unknown) {
  const parsed = z
    .object({
      transactionId: idSchema,
      direction: z.enum(["up", "down"]),
    })
    .parse(input);

  const { supabase, user } = await getUser();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Cash Flow account not found.");
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id, transaction_date, sort_order")
    .eq("id", parsed.transactionId)
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  if (!transaction) {
    throw new Error("Transaction not found.");
  }

  const { data: sameDay, error: sameDayError } = await supabase
    .from("transactions")
    .select("id, sort_order")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .eq("transaction_date", transaction.transaction_date)
    .order("sort_order", { ascending: true });

  if (sameDayError) {
    throw new Error(sameDayError.message);
  }

  if (!sameDay || sameDay.length < 2) {
    return { ok: true };
  }

  const currentIndex = sameDay.findIndex((item) => item.id === transaction.id);

  if (currentIndex === -1) {
    throw new Error("Transaction position could not be determined.");
  }

  const targetIndex =
    parsed.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= sameDay.length) {
    return { ok: true };
  }

  const reordered = [...sameDay];

  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  for (let index = 0; index < reordered.length; index += 1) {
    const { error } = await supabase
      .from("transactions")
      .update({
        sort_order: (index + 1) * 1000,
      })
      .eq("id", reordered[index].id)
      .eq("account_id", account.id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath("/cash-flow");

  return {
    ok: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Update Starting Balance                                                    */
/* -------------------------------------------------------------------------- */

export async function updateStartingBalance(input: unknown) {
  const rawInput = input as {
    monthStart?: unknown;
    startingBalance?: unknown;
  };

  const normalizedInput = {
    monthStart:
      typeof rawInput.monthStart === "string"
        ? normalizeMonthStart(rawInput.monthStart)
        : rawInput.monthStart,
    startingBalance: rawInput.startingBalance,
  };

  const parsed = updateBalanceSchema.parse(normalizedInput);

  const { supabase, user } = await getUser();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Cash Flow account not found.");
  }

  const { data: anchor, error: anchorFetchError } = await supabase
    .from("balance_anchors")
    .select("id, initial_date, initial_balance, status")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (anchorFetchError) {
    throw new Error(anchorFetchError.message);
  }

  if (!anchor) {
    throw new Error("Starting balance anchor not found.");
  }

  const anchorMonthStart = `${anchor.initial_date.slice(0, 7)}-01`;

  if (parsed.monthStart === anchorMonthStart) {
    const { error: anchorError } = await supabase
      .from("balance_anchors")
      .update({
        initial_balance: parsed.startingBalance,
        status: "connected",
      })
      .eq("id", anchor.id)
      .eq("account_id", account.id)
      .eq("user_id", user.id);

    if (anchorError) {
      throw new Error(anchorError.message);
    }

    const { error: overrideDeleteError } = await supabase
      .from("monthly_balance_overrides")
      .delete()
      .eq("account_id", account.id)
      .eq("user_id", user.id)
      .eq("month_start", parsed.monthStart);

    if (overrideDeleteError) {
      throw new Error(overrideDeleteError.message);
    }

    revalidatePath("/cash-flow");

    return {
      ok: true,
      source: "anchor",
    };
  }

  const { error: overrideError } = await supabase
    .from("monthly_balance_overrides")
    .upsert(
      {
        account_id: account.id,
        user_id: user.id,
        month_start: parsed.monthStart,
        starting_balance: parsed.startingBalance,
      },
      {
        onConflict: "account_id,month_start",
      },
    );

  if (overrideError) {
    throw new Error(overrideError.message);
  }

  revalidatePath("/cash-flow");

  return {
    ok: true,
    source: "override",
  };
}

/* -------------------------------------------------------------------------- */
/* Reconnect Starting Balance                                                 */
/* -------------------------------------------------------------------------- */

export async function reconnectStartingBalance(monthStart: string) {
  const normalizedMonthStart = normalizeMonthStart(monthStart);

  const parsed = z.string().date().parse(normalizedMonthStart);

  const { supabase, user } = await getUser();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Cash Flow account not found.");
  }

  const { error } = await supabase
    .from("monthly_balance_overrides")
    .delete()
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .eq("month_start", parsed);

  if (error) {
    throw new Error(error.message);
  }

  const { data: anchor, error: anchorFetchError } = await supabase
    .from("balance_anchors")
    .select("id, initial_date")
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (anchorFetchError) {
    throw new Error(anchorFetchError.message);
  }

  if (anchor) {
    const anchorMonthStart = `${anchor.initial_date.slice(0, 7)}-01`;

    if (parsed === anchorMonthStart) {
      const { error: anchorError } = await supabase
        .from("balance_anchors")
        .update({
          status: "connected",
        })
        .eq("id", anchor.id)
        .eq("account_id", account.id)
        .eq("user_id", user.id);

      if (anchorError) {
        throw new Error(anchorError.message);
      }
    }
  }

  revalidatePath("/cash-flow");

  return {
    ok: true,
    source: "previous_month",
  };
}
