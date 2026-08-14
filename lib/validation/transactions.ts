import { z } from "zod"

export const transactionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(120, "Name is too long"),

  amount: z
    .number()
    .finite()
    .positive("Amount must be greater than zero"),

  date: z.string().date(),

  type: z.enum(["income", "expense"]),
})

export type TransactionInput = z.infer<typeof transactionSchema>