export type CashFlowTransaction = {
  id: string
  name: string
  amount: number
  transactionDate: string
  sortOrder: number
}

export type CashFlowSummary = {
  startingBalance: number
  totalIncome: number
  totalExpenses: number
  endingBalance: number
}

export function calculateRunningBalances(
  startingBalance: number,
  transactions: CashFlowTransaction[],
) {
  let balance = startingBalance

  return transactions.map((transaction) => {
    balance += transaction.amount

    return {
      ...transaction,
      runningBalance: balance,
    }
  })
}

export function calculateMonthlySummary(
  startingBalance: number,
  transactions: CashFlowTransaction[],
): CashFlowSummary {
  const totalIncome = transactions
    .filter((transaction) => transaction.amount > 0)
    .reduce((total, transaction) => total + transaction.amount, 0)

  const totalExpenses = transactions
    .filter((transaction) => transaction.amount < 0)
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0)

  const endingBalance =
    startingBalance + totalIncome - totalExpenses

  return {
    startingBalance,
    totalIncome,
    totalExpenses,
    endingBalance,
  }
}

export function sortTransactions(
  transactions: CashFlowTransaction[],
) {
  return [...transactions].sort((a, b) => {
    const dateComparison =
      a.transactionDate.localeCompare(b.transactionDate)

    if (dateComparison !== 0) {
      return dateComparison
    }

    return a.sortOrder - b.sortOrder
  })
}