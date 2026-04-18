export function calculateStatus(
  activeContract: { endDate: string; paymentDay: number } | null,
  lastPaymentDate: string | null
): { estado: string; diasMora: number } {
  if (!activeContract) return { estado: "sin_contrato", diasMora: 0 };

  const today = new Date();
  const endDate = new Date(activeContract.endDate);
  const daysUntilEnd = Math.ceil(
    (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilEnd < 0) return { estado: "sin_contrato", diasMora: 0 };
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
