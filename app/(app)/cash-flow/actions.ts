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

  const { error: anchorError } = await supabase
    .from("balance_anchors")
    .insert({
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
    sameDay?.[0]?.sort_order != null
      ? sameDay[0].sort_order + 1000
      : 1000;

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
/* Update Starting Balance                                                    */
/* -------------------------------------------------------------------------- */

export async function updateStartingBalance(input: unknown) {
  /*
   * The client may send either:
   *
   *   2026-08
   *
   * or:
   *
   *   2026-08-01
   *
   * Normalize before Zod validation so both are supported.
   */
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

  /* ---------------------------------------------------------------------- */
  /* Find account                                                           */
  /* ---------------------------------------------------------------------- */

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Cash Flow account not found.");
  }

  /* ---------------------------------------------------------------------- */
  /* Find initial balance anchor                                            */
  /* ---------------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------------- */
  /* Initial balance                                                        */
  /* ---------------------------------------------------------------------- */

  /*
   * If the user is editing the ORIGINAL tracking month's starting balance,
   * update the anchor itself.
   *
   * This is important because the first starting balance is not really an
   * "override". It is the source balance for the entire Cash Flow timeline.
   */
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

    /*
     * If an old override exists for this same month, remove it.
     * The anchor is now the authoritative source again.
     */
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

  /* ---------------------------------------------------------------------- */
  /* Monthly override                                                       */
  /* ---------------------------------------------------------------------- */

  /*
   * Any month after the original tracking month is a genuine override.
   */
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

  /* ---------------------------------------------------------------------- */
  /* Find account                                                           */
  /* ---------------------------------------------------------------------- */

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) {
    throw new Error("Cash Flow account not found.");
  }

  /* ---------------------------------------------------------------------- */
  /* Remove monthly override                                               */
  /* ---------------------------------------------------------------------- */

  const { error } = await supabase
    .from("monthly_balance_overrides")
    .delete()
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .eq("month_start", parsed);

  if (error) {
    throw new Error(error.message);
  }

  /* ---------------------------------------------------------------------- */
  /* Restore anchor connection if this is the initial month                 */
  /* ---------------------------------------------------------------------- */

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