// contractStatus values that represent a contract not yet in force
const PENDING_STATUSES = new Set(["draft", "pending_signature"]);
// contractStatus values that represent a concluded contract
const HISTORICAL_STATUSES = new Set(["expired", "terminated"]);

export function calculateStatus(
  activeContract: { endDate: string; paymentDay: number; contractStatus?: string } | null,
  lastPaymentDate: string | null
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
      const diasMora = Math.ceil(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { estado: "en_mora", diasMora };
    }
  }

  return { estado: "activo", diasMora: 0 };
}
