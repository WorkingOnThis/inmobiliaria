export function calcDaysMora(dueDate: string | null, graceDays = 0): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate + "T00:00:00");
  due.setDate(due.getDate() + graceDays);
  const diff = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}
