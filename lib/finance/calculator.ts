export interface CalculationRow {
  id: string;
  amount: number;
  name?: string | null;
  sortOrder: number;
}

export interface CalculatedRow extends CalculationRow {
  runningValue: number;
}

export function calculateSimulation(rows: CalculationRow[]): CalculatedRow[] {
  let value = 0;
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => {
    value += row.amount;
    return { ...row, runningValue: value };
  });
}
