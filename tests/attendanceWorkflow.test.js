
import test from "node:test";
import assert from "node:assert/strict";

import {
  runAttendanceWorkflow
} from "../src/attendanceWorkflow.js";

test("não deve enviar lembrete quando existem quatro comprovantes", () => {
  const calls = [];

  const result = runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: (date) => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: (date) => {
      calls.push("drive");
      return 4;
    },

    hasAlreadyNotified: (date) => {
      calls.push("notification-check");
      return false;
    },

    sendReminder: (message) => {
      calls.push("telegram");
    },

    markAsNotified: (date) => {
      calls.push("register-notification");
    }
  });

  assert.deepEqual(result, {
    status: "enough_receipts",
    date: "2026-11-16",
    receiptCount: 4,
    notificationSent: false
  });

  assert.deepEqual(calls, [
    "calendar",
    "drive"
  ]);
});
