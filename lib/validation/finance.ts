import { z } from "zod";

export const transactionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  amount: z.number().finite().positive(),
  transactionDate: z.string().date(),
  type: z.enum(["income", "expense"]),
  recurrence: z.enum(["once", "weekly", "biweekly", "monthly", "yearly"]).default("once"),
});

export const calculatorRowSchema = z.object({
  amount: z.number().finite(),
  name: z.string().trim().max(120).nullable().optional(),
});
