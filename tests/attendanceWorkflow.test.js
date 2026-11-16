
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

test("não deve consultar o Drive em dia de folga", () => {
  const calls = [];

  const result = runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return true;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 0;
    },

    hasAlreadyNotified: () => false,
    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.equal(result.status, "day_off");
  assert.deepEqual(calls, ["calendar"]);
});

test("deve enviar e registrar lembrete com três comprovantes", () => {
  const calls = [];
  let sentMessage;

  const result = runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 3;
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      return false;
    },

    sendReminder: (message) => {
      calls.push("telegram");
      sentMessage = message;
    },

    markAsNotified: () => calls.push("register")
  });

  assert.equal(result.status, "reminder_sent");
  assert.equal(result.notificationSent, true);

  assert.deepEqual(sentMessage, {
    date: "2026-11-16",
    receiptCount: 3,
    expectedCount: 4
  });

  assert.deepEqual(calls, [
    "calendar",
    "drive",
    "notification-check",
    "telegram",
    "register"
  ]);
});

test("não deve repetir um lembrete já enviado", () => {
  const calls = [];

  const result = runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 2;
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      return true;
    },

    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.equal(result.status, "already_notified");
  assert.equal(result.notificationSent, false);

  assert.deepEqual(calls, [
    "calendar",
    "drive",
    "notification-check"
  ]);
});

test("não deve registrar notificação quando o envio falha", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 2;
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      return false;
    },

    sendReminder: () => {
      calls.push("telegram");
      throw new Error("Telegram unavailable");
    },

    markAsNotified: () => calls.push("register")
  });

  assert.throws(workflow, /Telegram unavailable/);

  assert.deepEqual(calls, [
    "calendar",
    "drive",
    "notification-check",
    "telegram"
  ]);
});

test("deve interromper o fluxo quando o Google Agenda falha", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      throw new Error("Calendar unavailable");
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 0;
    },

    hasAlreadyNotified: () => false,
    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.throws(workflow, /Calendar unavailable/);
  assert.deepEqual(calls, ["calendar"]);
});

test("deve rejeitar resposta inválida do Google Agenda", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return "false";
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 0;
    },

    hasAlreadyNotified: () => false,
    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.throws(workflow, /isDayOff must return a boolean/);
  assert.deepEqual(calls, ["calendar"]);
});

test("deve interromper o fluxo quando o Google Drive falha", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      throw new Error("Drive unavailable");
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      return false;
    },

    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.throws(workflow, /Drive unavailable/);

  assert.deepEqual(calls, [
    "calendar",
    "drive"
  ]);
});

test("deve rejeitar quantidade inválida retornada pelo Drive", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return -1;
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      return false;
    },

    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.throws(workflow, RangeError);

  assert.deepEqual(calls, [
    "calendar",
    "drive"
  ]);
});

test("deve interromper o fluxo quando falha a consulta de notificação anterior", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 3;
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      throw new Error("Notification storage unavailable");
    },

    sendReminder: () => calls.push("telegram"),
    markAsNotified: () => calls.push("register")
  });

  assert.throws(workflow, /Notification storage unavailable/);

  assert.deepEqual(calls, [
    "calendar",
    "drive",
    "notification-check"
  ]);
});

test("deve propagar falha ao registrar notificação após o envio", () => {
  const calls = [];

  const workflow = () => runAttendanceWorkflow({
    date: "2026-11-16",

    isDayOff: () => {
      calls.push("calendar");
      return false;
    },

    getReceiptCount: () => {
      calls.push("drive");
      return 3;
    },

    hasAlreadyNotified: () => {
      calls.push("notification-check");
      return false;
    },

    sendReminder: () => {
      calls.push("telegram");
    },

    markAsNotified: () => {
      calls.push("register");
      throw new Error("Notification registration failed");
    }
  });

  assert.throws(workflow, /Notification registration failed/);

  assert.deepEqual(calls, [
    "calendar",
    "drive",
    "notification-check",
    "telegram",
    "register"
  ]);
});
