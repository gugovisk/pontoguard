
import { shouldSendReminder } from "./attendanceRules.js";

/**
 * Coordena a conferência de comprovantes.
 *
 * Os serviços externos são recebidos como funções,
 * permitindo substituí-los por simuladores nos testes.
 *
 * @param {Object} dependencies
 * @param {string} dependencies.date Data da conferência.
 * @param {Function} dependencies.isDayOff Consulta de folga.
 * @param {Function} dependencies.getReceiptCount Consulta de comprovantes.
 * @param {Function} dependencies.hasAlreadyNotified Verifica alerta anterior.
 * @param {Function} dependencies.sendReminder Envia o lembrete.
 * @param {Function} dependencies.markAsNotified Registra alerta enviado.
 * @param {number} dependencies.limit Limite esperado.
 *
 * @returns {Object} Resultado da conferência.
 */
export function runAttendanceWorkflow({
  date,
  isDayOff,
  getReceiptCount,
  hasAlreadyNotified,
  sendReminder,
  markAsNotified,
  limit = 4
}) {
  if (typeof date !== "string" || !date.trim()) {
    throw new TypeError("date must be a non-empty string");
  }

  const dependencies = {
    isDayOff,
    getReceiptCount,
    hasAlreadyNotified,
    sendReminder,
    markAsNotified
  };

  for (const [name, dependency] of Object.entries(dependencies)) {
    if (typeof dependency !== "function") {
      throw new TypeError(`${name} must be a function`);
    }
  }

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError("limit must be a positive integer");
  }

  // 1. Verifica primeiro se o dia é de folga.
  const dayOff = isDayOff(date);

  if (typeof dayOff !== "boolean") {
    throw new TypeError("isDayOff must return a boolean");
  }

  if (dayOff) {
    return {
      status: "day_off",
      date,
      notificationSent: false
    };
  }

  // 2. Consulta a quantidade de comprovantes.
  const receiptCount = getReceiptCount(date);

  // 3. Decide se existe necessidade de lembrete.
  const reminderRequired = shouldSendReminder(
    receiptCount,
    false,
    limit
  );

  if (!reminderRequired) {
    return {
      status: "enough_receipts",
      date,
      receiptCount,
      notificationSent: false
    };
  }

  // 4. Evita repetir um alerta já enviado.
  const alreadyNotified = hasAlreadyNotified(date);

  if (typeof alreadyNotified !== "boolean") {
    throw new TypeError("hasAlreadyNotified must return a boolean");
  }

  if (alreadyNotified) {
    return {
      status: "already_notified",
      date,
      receiptCount,
      notificationSent: false
    };
  }

  // 5. Envia o lembrete.
  sendReminder({
    date,
    receiptCount,
    expectedCount: limit
  });

  // 6. Registra somente depois do envio bem-sucedido.
  markAsNotified(date);

  return {
    status: "reminder_sent",
    date,
    receiptCount,
    notificationSent: true
  };
}
