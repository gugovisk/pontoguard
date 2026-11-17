
import { canTransitionNotification, NOTIFICATION_STATUS } from "./notificationState.js";

const SCHEMA_VERSION = 1;

function validateDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new TypeError("date must use YYYY-MM-DD format");
  }
}

function validateStorage(storage) {
  if (
    !storage ||
    typeof storage.getProperty !== "function" ||
    typeof storage.setProperty !== "function"
  ) {
    throw new TypeError("storage must provide getProperty and setProperty");
  }
}

function getStorageKey(date) {
  validateDate(date);
  return `PONTOGUARD_NOTIFICATION_${date}`;
}

function validateRecord(record) {
  if (!record || typeof record !== "object") {
    throw new TypeError("record must be an object");
  }

  validateDate(record.date);

  if (record.schemaVersion !== SCHEMA_VERSION) {
    throw new TypeError("Invalid notification schema version");
  }

  if (
    !Object.values(NOTIFICATION_STATUS).includes(record.status)
  ) {
    throw new TypeError("Invalid notification status");
  }

  if (
    !Number.isInteger(record.attempts) ||
    record.attempts < 1
  ) {
    throw new TypeError("attempts must be a positive integer");
  }

  if (
    typeof record.createdAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    throw new TypeError("record timestamps must be strings");
  }

  return record;
}

export function getNotificationRecord(storage, date) {
  validateStorage(storage);

  const rawRecord = storage.getProperty(getStorageKey(date));

  if (rawRecord === null || rawRecord === undefined) {
    return null;
  }

  let record;

  try {
    record = JSON.parse(rawRecord);
  } catch {
    throw new Error("Stored notification record contains invalid JSON");
  }

  return validateRecord(record);
}

export function saveNotificationRecord(storage, record) {
  validateStorage(storage);
  validateRecord(record);

  storage.setProperty(
    getStorageKey(record.date),
    JSON.stringify(record)
  );

  return record;
}

export function createNotificationRecord(storage, date, now = new Date()) {
  validateStorage(storage);
  validateDate(date);

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  if (getNotificationRecord(storage, date)) {
    throw new Error("Notification record already exists");
  }

  const timestamp = now.toISOString();

  const record = {
    schemaVersion: SCHEMA_VERSION,
    date,
    status: NOTIFICATION_STATUS.SENDING,
    attempts: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastAttemptAt: timestamp,
    sentAt: null,
    lastError: null
  };

  return saveNotificationRecord(storage, record);
}

export function transitionNotification(
  storage,
  date,
  nextStatus,
  options = {},
  now = new Date()
) {
  validateStorage(storage);
  validateDate(date);

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const currentRecord = getNotificationRecord(storage, date);

  if (!currentRecord) {
    throw new Error("Notification record does not exist");
  }

  if (!canTransitionNotification(currentRecord.status, nextStatus)) {
    throw new Error(
      `Invalid notification transition: ${currentRecord.status} -> ${nextStatus}`
    );
  }

  const timestamp = now.toISOString();

  const updatedRecord = {
    ...currentRecord,
    status: nextStatus,
    updatedAt: timestamp
  };

  if (nextStatus === NOTIFICATION_STATUS.SENDING) {
    updatedRecord.attempts += 1;
    updatedRecord.lastAttemptAt = timestamp;
    updatedRecord.lastError = null;
  }

  if (nextStatus === NOTIFICATION_STATUS.SENT) {
    updatedRecord.sentAt = timestamp;
    updatedRecord.lastError = null;
  }

  if (nextStatus === NOTIFICATION_STATUS.FAILED) {
    updatedRecord.lastError =
      typeof options.error === "string"
        ? options.error
        : "Notification failed";
  }

  return saveNotificationRecord(storage, updatedRecord);
}
