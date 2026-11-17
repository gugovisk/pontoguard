
/**
 * Estados possíveis de uma notificação.
 */
export const NOTIFICATION_STATUS = Object.freeze({
  SENDING: "SENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  UNKNOWN: "UNKNOWN"
});

const VALID_STATUSES = new Set(
  Object.values(NOTIFICATION_STATUS)
);

/**
 * Define quais transições são permitidas.
 *
 * null representa uma notificação ainda não registrada.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  SENDING: ["SENT", "FAILED", "UNKNOWN"],
  SENT: [],
  FAILED: ["SENDING"],
  UNKNOWN: ["SENT", "FAILED"]
});

/**
 * Verifica se uma notificação pode mudar de estado.
 *
 * @param {string|null} currentStatus Estado atual.
 * @param {string} nextStatus Próximo estado desejado.
 * @returns {boolean} Indica se a transição é permitida.
 */
export function canTransitionNotification(
  currentStatus,
  nextStatus
) {
  if (
    currentStatus !== null &&
    !VALID_STATUSES.has(currentStatus)
  ) {
    throw new TypeError("Invalid current notification status");
  }

  if (!VALID_STATUSES.has(nextStatus)) {
    throw new TypeError("Invalid next notification status");
  }

  // Uma notificação nova só pode iniciar em SENDING.
  if (currentStatus === null) {
    return nextStatus === NOTIFICATION_STATUS.SENDING;
  }

  const allowedTransitions = ALLOWED_TRANSITIONS[currentStatus];

  return allowedTransitions.includes(nextStatus);
}
