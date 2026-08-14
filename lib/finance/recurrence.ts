import type { RecurrenceFrequency } from "@/types/finance";

export function nextOccurrence(date: Date, frequency: RecurrenceFrequency): Date | null {
  const next = new Date(date);
  switch (frequency) {
    case "once": return null;
    case "weekly": next.setDate(next.getDate() + 7); return next;
    case "biweekly": next.setDate(next.getDate() + 14); return next;
    case "monthly": next.setMonth(next.getMonth() + 1); return next;
    case "yearly": next.setFullYear(next.getFullYear() + 1); return next;
  }
}
