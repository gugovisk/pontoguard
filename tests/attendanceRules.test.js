
import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldSendReminder
} from "../src/attendanceRules.js";

test("deve solicitar lembrete quando não houver comprovantes", () => {
  assert.equal(shouldSendReminder(0, false), true);
});

test("deve solicitar lembrete com um comprovante", () => {
  assert.equal(shouldSendReminder(1, false), true);
});

test("deve solicitar lembrete com três comprovantes", () => {
  assert.equal(shouldSendReminder(3, false), true);
});

test("não deve solicitar lembrete com quatro comprovantes", () => {
  assert.equal(shouldSendReminder(4, false), false);
});

test("não deve solicitar lembrete com mais de quatro comprovantes", () => {
  assert.equal(shouldSendReminder(5, false), false);
});

test("não deve solicitar lembrete em dia de folga", () => {
  assert.equal(shouldSendReminder(0, true), false);
});

test("deve aceitar um limite personalizado", () => {
  assert.equal(shouldSendReminder(1, false, 2), true);
  assert.equal(shouldSendReminder(2, false, 2), false);
});

test("deve rejeitar quantidade negativa", () => {
  assert.throws(
    () => shouldSendReminder(-1, false),
    RangeError
  );
});

test("deve rejeitar quantidade não inteira", () => {
  assert.throws(
    () => shouldSendReminder(2.5, false),
    TypeError
  );
});

test("deve rejeitar indicação de folga inválida", () => {
  assert.throws(
    () => shouldSendReminder(3, "false"),
    TypeError
  );
});

test("deve rejeitar limite igual a zero", () => {
  assert.throws(
    () => shouldSendReminder(3, false, 0),
    RangeError
  );
});
