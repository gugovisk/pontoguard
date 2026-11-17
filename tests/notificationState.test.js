
import test from "node:test";
import assert from "node:assert/strict";

import {
  NOTIFICATION_STATUS,
  canTransitionNotification
} from "../src/notificationState.js";

const {
  SENDING,
  SENT,
  FAILED,
  UNKNOWN
} = NOTIFICATION_STATUS;

// 1. Uma notificação nova pode iniciar o envio.
test("should allow a new notification to enter SENDING", () => {
  assert.equal(
    canTransitionNotification(null, SENDING),
    true
  );
});

// 2. Uma notificação nova não pode começar como SENT.
test("should reject a new notification entering SENT", () => {
  assert.equal(
    canTransitionNotification(null, SENT),
    false
  );
});

// 3. Um envio em andamento pode ser confirmado.
test("should allow SENDING to transition to SENT", () => {
  assert.equal(
    canTransitionNotification(SENDING, SENT),
    true
  );
});

// 4. Uma falha confirmada pode ser registrada.
test("should allow SENDING to transition to FAILED", () => {
  assert.equal(
    canTransitionNotification(SENDING, FAILED),
    true
  );
});

// 5. Uma situação incerta pode ser registrada.
test("should allow SENDING to transition to UNKNOWN", () => {
  assert.equal(
    canTransitionNotification(SENDING, UNKNOWN),
    true
  );
});

// 6. Uma falha confirmada permite uma nova tentativa.
test("should allow FAILED to transition to SENDING", () => {
  assert.equal(
    canTransitionNotification(FAILED, SENDING),
    true
  );
});

// 7. Uma notificação enviada não pode voltar a ser enviada.
test("should prevent SENT from returning to SENDING", () => {
  assert.equal(
    canTransitionNotification(SENT, SENDING),
    false
  );
});

// 8. Uma notificação enviada não pode voltar para FAILED.
test("should prevent SENT from transitioning to FAILED", () => {
  assert.equal(
    canTransitionNotification(SENT, FAILED),
    false
  );
});

// 9. Não pode haver repetição automática em situação incerta.
test("should prevent UNKNOWN from returning directly to SENDING", () => {
  assert.equal(
    canTransitionNotification(UNKNOWN, SENDING),
    false
  );
});

// 10. Uma situação incerta pode ser confirmada como enviada.
test("should allow UNKNOWN to transition to SENT", () => {
  assert.equal(
    canTransitionNotification(UNKNOWN, SENT),
    true
  );
});

// 11. Uma situação incerta pode ser considerada falha após reconciliação.
test("should allow UNKNOWN to transition to FAILED", () => {
  assert.equal(
    canTransitionNotification(UNKNOWN, FAILED),
    true
  );
});

// 12. Uma transição inválida não pode ser iniciada.
test("should reject an invalid current status", () => {
  assert.throws(
    () => canTransitionNotification("PROCESSING", SENT),
    TypeError
  );
});

// 13. Um estado inexistente não pode ser utilizado.
test("should reject an invalid next status", () => {
  assert.throws(
    () => canTransitionNotification(SENDING, "DELIVERED"),
    TypeError
  );
});
