import type { TransactionType } from "@/types/finance";

export function toSignedAmount(type: TransactionType, amount: number): number {
  const absolute = Math.abs(amount);
  return type === "expense" ? -absolute : absolute;
}

export function canReorderSameDate(sourceDate: string, destinationDate: string): boolean {
  return sourceDate === destinationDate;
}

export function normalizeSortOrders(ids: string[], start = 1000, step = 1000): Record<string, number> {
  return Object.fromEntries(ids.map((id, index) => [id, start + index * step]));
}
