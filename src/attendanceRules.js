
/**
 * Decide se o PontoGuard deve enviar um lembrete.
 *
 * @param {number} receiptCount Quantidade de comprovantes únicos.
 * @param {boolean} isDayOff Indica se o dia é de folga.
 * @param {number} limit Quantidade mínima esperada de comprovantes.
 * @returns {boolean} true quando um lembrete deve ser enviado.
 */
export function shouldSendReminder(
  receiptCount,
  isDayOff,
  limit = 4
) {
  if (
    typeof receiptCount !== "number" ||
    !Number.isInteger(receiptCount)
  ) {
    throw new TypeError("receiptCount must be an integer");
  }

  if (receiptCount < 0) {
    throw new RangeError("receiptCount cannot be negative");
  }

  if (typeof isDayOff !== "boolean") {
    throw new TypeError("isDayOff must be a boolean");
  }

  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit)
  ) {
    throw new TypeError("limit must be an integer");
  }

  if (limit <= 0) {
    throw new RangeError("limit must be greater than zero");
  }

  if (isDayOff) {
    return false;
  }

  return receiptCount < limit;
}
