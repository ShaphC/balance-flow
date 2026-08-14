"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validation/finance";
import { z } from "zod";

const setupSchema = z.object({
  initialDate: z.string().date(),
  initialBalance: z.number().finite(),
});

const updateBalanceSchema = z.object({
  monthStart: z.string().date(),
  startingBalance: z.number().finite(),
});

const idSchema = z.string().uuid();

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function createCashFlowSetup(input: unknown) {
  const parsed = setupSchema.parse(input);
  const { supabase, user } = await getUser();

  const { data: existing } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return { ok: true };

  const { data: account, error: accountError } = await supabase
    .from("financial_accounts")
    .insert({ user_id: user.id, name: "Personal Cash Flow" })
    .select("id")
    .single();

  if (accountError) throw new Error(accountError.message);

  const { error: anchorError } = await supabase.from("balance_anchors").insert({
    account_id: account.id,
    user_id: user.id,
    initial_date: parsed.initialDate,
    initial_balance: parsed.initialBalance,
    status: "connected",
  });

  if (anchorError) throw new Error(anchorError.message);
  revalidatePath("/cash-flow");
  return { ok: true };
}

export async function createTransaction(input: unknown) {
  const parsed = transactionSchema.parse(input);
  const { supabase, user } = await getUser();

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) throw new Error("Set up your Cash Flow before adding transactions.");

  const { data: sameDay } = await supabase
    .from("transactions")
    .select("sort_order")
    .eq("account_id", account.id)
    .eq("transaction_date", parsed.transactionDate)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = sameDay?.[0]?.sort_order ? sameDay[0].sort_order + 1000 : 1000;
  const signedAmount = parsed.type === "expense" ? -Math.abs(parsed.amount) : Math.abs(parsed.amount);

  const { error } = await supabase.from("transactions").insert({
    account_id: account.id,
    user_id: user.id,
    name: parsed.name,
    amount: signedAmount,
    transaction_date: parsed.transactionDate,
    sort_order: nextSortOrder,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/cash-flow");
  return { ok: true };
}

export async function updateTransaction(input: unknown) {
  const parsed = transactionSchema.extend({ id: idSchema }).parse(input);
  const { supabase, user } = await getUser();
  const signedAmount = parsed.type === "expense" ? -Math.abs(parsed.amount) : Math.abs(parsed.amount);
  const { error } = await supabase
    .from("transactions")
    .update({
      name: parsed.name,
      amount: signedAmount,
      transaction_date: parsed.transactionDate,
    })
    .eq("id", parsed.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/cash-flow");
  return { ok: true };
}

export async function deleteTransaction(id: string) {
  const transactionId = idSchema.parse(id);
  const { supabase, user } = await getUser();
  const { error } = await supabase.from("transactions").delete().eq("id", transactionId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/cash-flow");
  return { ok: true };
}

export async function updateStartingBalance(input: unknown) {
  const parsed = updateBalanceSchema.parse(input);
  const { supabase, user } = await getUser();
  const { data: account } = await supabase.from("financial_accounts").select("id").eq("user_id", user.id).maybeSingle();
  if (!account) throw new Error("Cash Flow account not found.");

  const { data: anchor } = await supabase.from("balance_anchors").select("id,initial_date").eq("account_id", account.id).single();
  if (!anchor) throw new Error("Starting balance anchor not found.");

  const { error } = await supabase.from("monthly_balance_overrides").upsert({
    account_id: account.id,
    user_id: user.id,
    month_start: parsed.monthStart,
    starting_balance: parsed.startingBalance,
  }, { onConflict: "account_id,month_start" });
  if (error) throw new Error(error.message);

  if (parsed.monthStart === `${anchor.initial_date.slice(0, 7)}-01`) {
    const { error: anchorError } = await supabase.from("balance_anchors").update({ status: "overridden" }).eq("id", anchor.id).eq("user_id", user.id);
    if (anchorError) throw new Error(anchorError.message);
  }

  revalidatePath("/cash-flow");
  return { ok: true };
}

export async function reconnectStartingBalance(monthStart: string) {
  const parsed = z.string().date().parse(monthStart);
  const { supabase, user } = await getUser();
  const { error } = await supabase
    .from("monthly_balance_overrides")
    .delete()
    .eq("month_start", parsed)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  const { data: account } = await supabase.from("financial_accounts").select("id").eq("user_id", user.id).maybeSingle();
  if (account) {
    const { data: anchor } = await supabase.from("balance_anchors").select("id,initial_date").eq("account_id", account.id).maybeSingle();
    if (anchor && parsed === `${anchor.initial_date.slice(0, 7)}-01`) {
      const { error: anchorError } = await supabase.from("balance_anchors").update({ status: "connected" }).eq("id", anchor.id).eq("user_id", user.id);
      if (anchorError) throw new Error(anchorError.message);
    }
  }

  revalidatePath("/cash-flow");
  return { ok: true };
}
