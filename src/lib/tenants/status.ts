const PENDING_STATUSES = new Set(["draft", "pending_signature"]);
const HISTORICAL_STATUSES = new Set(["expired", "terminated"]);

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Returns the same date if it's already a business day, otherwise advances to the next one.
// holidays: array of "YYYY-MM-DD" strings in local time.
function nextBusinessDay(date: Date, holidays: string[]): Date {
  const d = new Date(date);
  const toLocal = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  while (isWeekend(d) || holidays.includes(toLocal(d))) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function calculateStatus(
  activeContract: {
    endDate: string;
    paymentDay: number;
    contractStatus?: string;
    graceDays?: number;
  } | null,
  lastPaymentDate: string | null,
  holidays: string[] = []
): { estado: string; diasMora: number } {
  if (!activeContract) return { estado: "sin_contrato", diasMora: 0 };

  if (activeContract.contractStatus && PENDING_STATUSES.has(activeContract.contractStatus)) {
    return { estado: "pendiente_firma", diasMora: 0 };
  }
  if (activeContract.contractStatus && HISTORICAL_STATUSES.has(activeContract.contractStatus)) {
    return { estado: "historico", diasMora: 0 };
  }

  const today = new Date();
  const endDate = new Date(activeContract.endDate);
  const daysUntilEnd = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilEnd < 0) return { estado: "historico", diasMora: 0 };
  if (daysUntilEnd <= 90) return { estado: "por_vencer", diasMora: 0 };

  const todayDay = today.getDate();
  if (todayDay > activeContract.paymentDay) {
    const dueDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      activeContract.paymentDay
    );
    if (!lastPaymentDate || new Date(lastPaymentDate) < dueDate) {
      const graceDays = activeContract.graceDays ?? 0;

      // Last calendar day of the grace period
      const graceEnd = new Date(dueDate);
      graceEnd.setDate(graceEnd.getDate() + graceDays);

      // If grace ends on a non-business day, extend it to the next business day.
      // This means the tenant pays normally on that day (no punitorios).
      const effectiveGraceEnd = nextBusinessDay(graceEnd, holidays);

      // Mora starts on the first business day *after* the grace period ends.
      const dayAfterGrace = new Date(effectiveGraceEnd);
      dayAfterGrace.setDate(dayAfterGrace.getDate() + 1);
      const moraStart = nextBusinessDay(dayAfterGrace, holidays);

      if (today >= moraStart) {
        const diasMora = Math.ceil(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return { estado: "en_mora", diasMora };
      }
    }
  }

  return { estado: "activo", diasMora: 0 };
}
