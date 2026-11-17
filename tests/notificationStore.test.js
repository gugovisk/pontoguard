
import test from "node:test";
import assert from "node:assert/strict";

import {
  getNotificationRecord,
  saveNotificationRecord,
  createNotificationRecord,
  transitionNotification
} from "../src/notificationStore.js";

import { NOTIFICATION_STATUS } from "../src/notificationState.js";

// Armazenamento em memória para simular o PropertiesService.
function createMemoryStorage() {
  const data = new Map();

  return {
    getProperty(key) {
      return data.has(key) ? data.get(key) : null;
    },

    setProperty(key, value) {
      data.set(key, value);
    }
  };
}

const DATE = "2026-11-17";
const FIXED_DATE = new Date("2026-11-17T23:45:00.000Z");

test("should return null when no notification exists", () => {
  const storage = createMemoryStorage();

  assert.equal(
    getNotificationRecord(storage, DATE),
    null
  );
});

test("should create a notification in SENDING status", () => {
  const storage = createMemoryStorage();

  const record = createNotificationRecord(
    storage,
    DATE,
    FIXED_DATE
  );

  assert.equal(record.status, NOTIFICATION_STATUS.SENDING);
  assert.equal(record.attempts, 1);
  assert.equal(record.date, DATE);
  assert.equal(record.schemaVersion, 1);
});

test("should retrieve a previously saved notification", () => {
  const storage = createMemoryStorage();

  createNotificationRecord(storage, DATE, FIXED_DATE);

  const record = getNotificationRecord(storage, DATE);

  assert.equal(record.status, NOTIFICATION_STATUS.SENDING);
  assert.equal(record.createdAt, FIXED_DATE.toISOString());
});

test("should reject creating a duplicate notification record", () => {
  const storage = createMemoryStorage();

  createNotificationRecord(storage, DATE, FIXED_DATE);

  assert.throws(
    () => createNotificationRecord(storage, DATE, FIXED_DATE),
    /already exists/
  );
});

test("should preserve notification data when saving", () => {
  const storage = createMemoryStorage();

  const record = {
    schemaVersion: 1,
    date: DATE,
    status: NOTIFICATION_STATUS.SENDING,
    attempts: 1,
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString(),
    lastAttemptAt: FIXED_DATE.toISOString(),
    sentAt: null,
    lastError: null
  };

  saveNotificationRecord(storage, record);

  assert.deepEqual(
    getNotificationRecord(storage, DATE),
    record
  );
});

test("should transition SENDING to SENT", () => {
  const storage = createMemoryStorage();

  createNotificationRecord(storage, DATE, FIXED_DATE);

  const record = transitionNotification(
    storage,
    DATE,
    NOTIFICATION_STATUS.SENT,
    {},
    new Date("2026-11-17T23:46:00.000Z")
  );

  assert.equal(record.status, NOTIFICATION_STATUS.SENT);
  assert.equal(record.sentAt, "2026-11-17T23:46:00.000Z");
});

test("should transition SENDING to FAILED and save the error", () => {
  const storage = createMemoryStorage();

  createNotificationRecord(storage, DATE, FIXED_DATE);

  const record = transitionNotification(
    storage,
    DATE,
    NOTIFICATION_STATUS.FAILED,
    { error: "Telegram unavailable" },
    FIXED_DATE
  );

  assert.equal(record.status, NOTIFICATION_STATUS.FAILED);
  assert.equal(record.lastError, "Telegram unavailable");
});

test("should increment attempts when retrying after FAILED", () => {
  const storage = createMemoryStorage();

  createNotificationRecord(storage, DATE, FIXED_DATE);

  transitionNotification(
    storage,
    DATE,
    NOTIFICATION_STATUS.FAILED,
    { error: "Temporary error" },
    FIXED_DATE
  );

  const record = transitionNotification(
    storage,
    DATE,
    NOTIFICATION_STATUS.SENDING,
    {},
    new Date("2026-11-17T23:47:00.000Z")
  );

  assert.equal(record.status, NOTIFICATION_STATUS.SENDING);
  assert.equal(record.attempts, 2);
  assert.equal(record.lastError, null);
});

test("should prevent UNKNOWN from returning directly to SENDING", () => {
  const storage = createMemoryStorage();

  createNotificationRecord(storage, DATE, FIXED_DATE);

  transitionNotification(
    storage,
    DATE,
    NOTIFICATION_STATUS.UNKNOWN,
    {},
    FIXED_DATE
  );

  assert.throws(
    () => transitionNotification(
      storage,
      DATE,
      NOTIFICATION_STATUS.SENDING,
      {},
      FIXED_DATE
    ),
    /Invalid notification transition/
  );
});

test("should reject invalid dates", () => {
  const storage = createMemoryStorage();

  assert.throws(
    () => getNotificationRecord(storage, "17-11-2026"),
    /YYYY-MM-DD/
  );
});

test("should reject invalid notification statuses", () => {
  const storage = createMemoryStorage();

  const record = {
    schemaVersion: 1,
    date: DATE,
    status: "DELIVERED",
    attempts: 1,
    createdAt: FIXED_DATE.toISOString(),
    updatedAt: FIXED_DATE.toISOString()
  };

  assert.throws(
    () => saveNotificationRecord(storage, record),
    /Invalid notification status/
  );
});

test("should reject invalid JSON in storage", () => {
  const storage = createMemoryStorage();

  storage.setProperty(
    `PONTOGUARD_NOTIFICATION_${DATE}`,
    "{invalid-json"
  );

  assert.throws(
    () => getNotificationRecord(storage, DATE),
    /invalid JSON/
  );
});
