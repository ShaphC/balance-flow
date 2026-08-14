export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")

  return `${year}-${month}`
}

export function parseMonthKey(monthKey: string): {
  year: number
  month: number
} {
  const [year, month] = monthKey.split("-").map(Number)

  return {
    year,
    month,
  }
}

export function formatMonthLabel(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey)

  const date = new Date(year, month - 1, 1)

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date)
}

export function shiftMonth(monthKey: string, offset: number): string {
  const { year, month } = parseMonthKey(monthKey)

  const date = new Date(year, month - 1 + offset, 1)

  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0")

  return `${nextYear}-${nextMonth}`
}