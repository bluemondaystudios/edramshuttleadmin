/** Where a receipt lives in the private 'receipts' bucket: {yyyy}/{mm}/{expense_id}.jpg (by the expense date). */
export function receiptPath(expenseId: string, spentOn: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(spentOn);
  if (!m) throw new Error(`Not an ISO date: ${spentOn}`);
  if (!/^[0-9a-f-]{36}$/i.test(expenseId)) throw new Error(`Not an expense id: ${expenseId}`);
  return `${m[1]}/${m[2]}/${expenseId.toLowerCase()}.jpg`;
}
