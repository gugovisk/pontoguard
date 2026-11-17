# PontoGuard

**Automated Attendance Receipt Verification and Notification System**

PontoGuard is a personal automation project designed to verify attendance punch receipts, identify potentially missing records, and notify the user when manual verification may be necessary.

The project combines JavaScript, automated testing, Google Apps Script, Google services, and Telegram notifications.

It is also a practical software development portfolio project focused on modular architecture, software testing, continuous integration, notification reliability, and real-world automation.

## 1. Project Objective

The main objective is to automate the verification of attendance punch receipts stored in Google Drive.

The intended system workflow is designed to:

1. Read attendance receipt filenames.
2. Extract Unix timestamps in milliseconds.
3. Convert timestamps into dates and times using the `America/Sao_Paulo` timezone.
4. Count unique receipts associated with each workday.
5. Check scheduled days off using Google Calendar.
6. Notify the user through Telegram when fewer than four receipts are found on a working day.

The system uses filenames as its source of timestamp information, without relying on image metadata or image recognition.

PontoGuard is a personal reminder tool. It does not replace an official attendance management system.

## 2. Project Status

**Current stage: Core development, workflow orchestration, notification state modeling, storage abstraction, and automated testing.**

### Implemented in the GitHub repository

- [x] Filename timestamp parser.
- [x] Unix timestamp conversion.
- [x] `America/Sao_Paulo` timezone handling.
- [x] Receipt grouping by date.
- [x] Duplicate timestamp detection.
- [x] Invalid filename handling.
- [x] Attendance reminder decision rules.
- [x] Workflow orchestration with injected dependencies.
- [x] Simulated workflow tests.
- [x] Workflow resilience tests.
- [x] Notification lifecycle state model.
- [x] Notification state transition validation.
- [x] Notification storage abstraction with an injectable adapter.
- [x] Notification record creation, retrieval, and saving.
- [x] Notification record validation.
- [x] Notification state transitions through the storage module.
- [x] Retry attempt tracking after confirmed failures.
- [x] Automated unit tests.
- [x] GitHub Actions continuous integration.

### Validated separately using Google Apps Script

- [x] Google Drive folder reading.
- [x] Receipt counting and timestamp deduplication.
- [x] Google Calendar day-off verification.
- [x] Telegram Bot API message delivery.
- [x] Integrated historical validation scenarios.

### Not yet enabled or completed

- [ ] Connect the notification storage abstraction to Google Apps Script `PropertiesService`.
- [ ] Integrate notification state management into the real attendance workflow.
- [ ] Add concurrency control for notification processing.
- [ ] Implement safe notification recovery and reconciliation.
- [ ] Connect the Node.js workflow to real Google service adapters.
- [ ] Add sanitized Apps Script source code to this repository.
- [ ] Improve handling of delayed file synchronization.
- [ ] Configure the automatic daily trigger.
- [ ] Implement additional operational monitoring.
- [ ] Expand automated testing for real service integrations.

**Important:** The notification storage module currently provides storage operations through an injected adapter. Its automated tests use an in-memory implementation. Actual persistent storage through Google Apps Script PropertiesService has not yet been connected.

Automated workflow and storage tests use simulated dependencies. They do not make real Google or Telegram API requests.

The Google Apps Script implementation remains in a separate personal project, and daily scheduled execution has not been activated.

## 3. How It Works

The intended operational workflow is:

1. Attendance receipt images are stored on an Android device.
2. FolderSync synchronizes the files with Google Drive.
3. Google Apps Script reads the filenames from the configured Drive folder.
4. The timestamp embedded in each filename is extracted.
5. Timestamps are converted into dates using the `America/Sao_Paulo` timezone.
6. Google Calendar is checked for a day-off event titled `Folga`.
7. Unique receipts are counted for the analyzed workday.
8. If fewer than four receipts are found on a working day, the system can send a Telegram reminder.

The Google Apps Script prototype checks the day-off condition before processing receipts.

The Node.js core separately implements attendance decision rules, workflow orchestration, notification state management, and notification storage operations.

## 4. Business Rules

| Rule | Description |
|---|---|
| Filename pattern | `Comprovante_Ponto_Mobile_TIMESTAMP` |
| Timestamp format | 13-digit Unix timestamp in milliseconds |
| Timezone | `America/Sao_Paulo` |
| Supported extensions | JPG, JPEG, PNG, WEBP |
| Duplicate detection | Identical timestamps count only once |
| Invalid filenames | Ignored during processing |
| Day-off identification | Default Google Calendar event titled `Folga` |
| Expected receipts | Four unique receipts per working day |
| Notification condition | Fewer than four receipts on a working day |

The expected number of receipts is an initial configurable business rule.

## 5. Core Features

### Filename Parser

The `parseFilename()` function validates receipt filenames, extracts the timestamp, and converts it into a date and time.

Expected filename pattern:

`Comprovante_Ponto_Mobile_TIMESTAMP.jpg`

Supported extensions:

- JPG
- JPEG
- PNG
- WEBP

Example:

`Comprovante_Ponto_Mobile_1770416909454.jpg`

Expected output:

```json
{
  "timestamp": 1770416909454,
  "date": "2026-02-06",
  "time": "19:28:29"
}
```

All date and time conversions use the `America/Sao_Paulo` timezone.

### Receipt Summarization

The `summarizeReceipts()` function processes a list of filenames and produces a summary containing:

- `byDate`: number of unique receipts grouped by date.
- `totalReceipts`: total number of unique valid receipts.
- `ignoredFiles`: number of invalid filenames.
- `duplicateFiles`: number of repeated timestamps.

Duplicate detection is implemented using JavaScript's built-in `Set` data structure.

A receipt with the same timestamp is counted only once, even when multiple files have different extensions.

### Attendance Reminder Rules

The `shouldSendReminder()` function determines whether a reminder is necessary based on:

- The number of unique attendance receipts.
- Whether the analyzed day is a day off.
- The expected minimum number of receipts.

The default threshold is four receipts per working day.

The function validates its inputs and can be tested independently without external services.

### Attendance Workflow

The `runAttendanceWorkflow()` function coordinates attendance verification through injected dependencies.

Its responsibilities include:

1. Checking whether the date is a day off.
2. Obtaining the receipt count.
3. Evaluating the reminder condition.
4. Checking whether a notification was already sent.
5. Requesting notification delivery.
6. Recording the notification after successful delivery.

The workflow receives service functions as dependencies, allowing simulated implementations to be used during automated testing.

### Notification State Machine

The `notificationState.js` module defines four notification lifecycle states:

| State | Description |
|---|---|
| `SENDING` | Notification delivery has started |
| `SENT` | Notification delivery was confirmed |
| `FAILED` | Delivery failure was confirmed |
| `UNKNOWN` | Delivery result is uncertain |

The `canTransitionNotification()` function validates permitted state transitions.

The implemented transition rules include:

| Current state | Next state | Allowed |
|---|---|---|
| New notification | `SENDING` | Yes |
| `SENDING` | `SENT` | Yes |
| `SENDING` | `FAILED` | Yes |
| `SENDING` | `UNKNOWN` | Yes |
| `FAILED` | `SENDING` | Yes |
| `UNKNOWN` | `SENT` | Yes |
| `UNKNOWN` | `FAILED` | Yes, after reconciliation |
| `SENT` | `SENDING` | No |
| `UNKNOWN` | `SENDING` | No |

An uncertain notification must be reconciled before another delivery attempt.

### Notification Storage

The `notificationStore.js` module provides an injectable storage abstraction for notification records.

Its main operations are:

- `getNotificationRecord()`: retrieves a notification record using its date.
- `saveNotificationRecord()`: validates and saves a notification record.
- `createNotificationRecord()`: creates a new notification record in the `SENDING` state.
- `transitionNotification()`: changes the notification state while respecting the state machine rules.

Each record is identified by a date-based key:

`PONTOGUARD_NOTIFICATION_YYYY-MM-DD`

The record includes:

- Schema version.
- Attendance date.
- Notification status.
- Number of attempts.
- Creation timestamp.
- Last update timestamp.
- Last attempt timestamp.
- Successful delivery timestamp, when applicable.
- Last recorded error, when applicable.

The storage module validates record structure, notification status, date format, attempt count, and stored JSON.

Retry attempts are incremented when a notification transitions from `FAILED` back to `SENDING`.

The module prevents an automatic transition from `UNKNOWN` directly to `SENDING`. Reconciliation is required before another delivery attempt.

Automated tests use an in-memory storage adapter that simulates the `getProperty()` and `setProperty()` interface.

**Current limitation:** The storage abstraction is implemented and tested, but it is not yet connected to Google Apps Script PropertiesService. Persistent production storage, concurrency control, and workflow integration remain pending.

## 6. Technologies

| Technology | Purpose |
|---|---|
| JavaScript (ES Modules) | Application logic |
| Node.js | Runtime environment |
| Node.js Test Runner | Automated unit testing |
| Git | Version control |
| GitHub | Source code hosting |
| GitHub Actions | Continuous integration |
| Google Apps Script | External service automation |
| Google Drive Services | Receipt file access |
| Google Calendar Services | Day-off verification |
| Telegram Bot API | User notifications |
| FolderSync | Android-to-Drive synchronization |

The Node.js core does not require external npm dependencies.

Google services are accessed through Google Apps Script in the separate integration prototype.

## 7. Project Structure

```text
pontoguard/
│
├── .github/
│   └── workflows/
│       └── tests.yml
│
├── src/
│   ├── filenameParser.js
│   ├── driveService.js
│   ├── attendanceRules.js
│   ├── attendanceWorkflow.js
│   ├── notificationState.js
│   └── notificationStore.js
│
├── tests/
│   ├── filenameParser.test.js
│   ├── driveService.test.js
│   ├── attendanceRules.test.js
│   ├── attendanceWorkflow.test.js
│   ├── notificationState.test.js
│   └── notificationStore.test.js
│
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

### Main Modules

| File | Responsibility |
|---|---|
| `filenameParser.js` | Filename validation and timestamp extraction |
| `driveService.js` | Receipt summarization and duplicate detection |
| `attendanceRules.js` | Attendance reminder decision rules and input validation |
| `attendanceWorkflow.js` | Attendance verification orchestration using injected dependencies |
| `notificationState.js` | Notification states and transition validation |
| `notificationStore.js` | Notification record storage abstraction and state transitions |
| `filenameParser.test.js` | Parser unit tests |
| `driveService.test.js` | Receipt processing unit tests |
| `attendanceRules.test.js` | Attendance decision rule tests |
| `attendanceWorkflow.test.js` | Simulated workflow and resilience tests |
| `notificationState.test.js` | Notification state transition tests |
| `notificationStore.test.js` | Notification storage and validation tests |
| `tests.yml` | GitHub Actions workflow |

## 8. Requirements

- Node.js 20 or later.
- npm.
- Git (optional for local development).

The GitHub Actions workflow currently uses Node.js 22.

No external npm dependencies are required to run the current test suite.

## 9. Installation and Testing

Clone the repository:

```bash
git clone https://github.com/gugovisk/pontoguard.git
```

Navigate to the project directory:

```bash
cd pontoguard
```

Run the automated tests:

```bash
npm test
```

The project uses Node.js's built-in Test Runner and the `node:assert/strict` module.

### Test Scenarios

The automated test suite currently contains **60 tests**.

**Filename and receipt processing**

- Valid and invalid filenames.
- Timestamp extraction.
- Timezone conversion.
- Receipt grouping by date.
- Empty input lists.
- Duplicate timestamp detection.
- Invalid input handling.

**Attendance reminder rules**

- Zero, one, three, four, and more than four receipts.
- Day-off handling.
- Custom receipt thresholds.
- Negative and non-integer quantities.
- Invalid day-off values.

**Simulated attendance workflow**

- Sufficient receipts without sending notifications.
- Skipping Drive access on days off.
- Sending and recording reminders when receipts are missing.
- Preventing repeated reminders.
- Handling Telegram sending failures.

**Workflow resilience**

- Google Calendar service failures.
- Invalid Google Calendar responses.
- Google Drive service failures.
- Invalid receipt counts.
- Notification storage lookup failures.
- Notification registration failures after message delivery.

**Notification state management**

- Creating a new notification in `SENDING`.
- Validating transitions to `SENT`, `FAILED`, and `UNKNOWN`.
- Allowing retries after confirmed failures.
- Preventing repeated sending after confirmed delivery.
- Blocking automatic retries when delivery is uncertain.
- Rejecting invalid notification states.

**Notification storage**

- Returning `null` when no record exists.
- Creating notification records.
- Retrieving previously saved records.
- Rejecting duplicate records.
- Preserving notification data.
- Transitioning from `SENDING` to `SENT`.
- Transitioning from `SENDING` to `FAILED`.
- Incrementing attempts after confirmed failures.
- Preventing direct retries from `UNKNOWN`.
- Rejecting invalid dates.
- Rejecting invalid notification statuses.
- Handling invalid JSON in storage.

Workflow and notification storage tests use isolated functions and simulated dependencies. They do not make real API requests.

## 10. Continuous Integration

PontoGuard uses GitHub Actions to execute automated tests.

The workflow is defined in:

`.github/workflows/tests.yml`

It runs when:

- Changes are pushed to the `main` branch.
- A pull request targets the `main` branch.

The workflow performs the following steps:

1. Checks out the repository.
2. Sets up Node.js 22.
3. Executes `npm test`.

This helps detect regressions before changes are incorporated into the main branch.

## 11. Google Apps Script Integration

A separate Google Apps Script project has been developed and manually validated.

Its current capabilities include:

- Reading receipt filenames from Google Drive.
- Grouping receipts by date.
- Counting unique timestamps.
- Checking day-off events in Google Calendar.
- Sending Telegram messages through the Telegram Bot API.
- Running historical attendance verification scenarios.

External credentials and identifiers are stored in Google Apps Script Script Properties rather than directly in the source code.

The Apps Script source has not yet been added to this repository.

The Node.js workflow and the Apps Script integration are currently separate components. Connecting them through real service adapters and implementing persistent notification storage in Google Apps Script remain part of the development roadmap.

## 12. Security and Privacy

Security and privacy are important considerations because the project handles personal attendance information.

The public repository must never contain:

- Real attendance receipt images.
- Telegram bot tokens.
- Telegram chat IDs.
- Private Google Drive folder identifiers.
- Google account credentials.
- Personal attendance records.
- Other sensitive personal information.

External service credentials should be stored outside the source code, using secure configuration mechanisms such as Google Apps Script Script Properties.

Only sanitized examples and test fixtures should be committed to this repository.

## 13. Current Limitations

The current implementation has some known limitations:

- The core parser depends on the expected filename convention.
- The Node.js core does not inspect image contents.
- The Apps Script prototype currently uses the default Google Calendar.
- Delayed file synchronization may temporarily cause an undercount.
- The Node.js workflow is not yet connected to real Google service adapters.
- The notification storage abstraction does not yet use a real persistent storage adapter.
- Notification state transitions are not yet protected by concurrency control.
- The notification state and storage modules are not yet integrated into the attendance workflow.
- An uncertain Telegram delivery result requires reconciliation before retrying.
- The daily scheduled trigger has not been activated.
- Real external service integrations do not yet have automated CI coverage.

These limitations are being addressed incrementally.

## 14. Development Roadmap

- [x] Develop the filename parser.
- [x] Implement receipt grouping by date.
- [x] Implement duplicate timestamp detection.
- [x] Create automated unit tests.
- [x] Configure GitHub Actions.
- [x] Implement attendance reminder decision rules.
- [x] Implement workflow orchestration with injected dependencies.
- [x] Add simulated workflow tests for normal scenarios.
- [x] Add simulated workflow resilience tests.
- [x] Define notification lifecycle states.
- [x] Validate permitted notification state transitions.
- [x] Add automated notification state tests.
- [x] Implement notification storage abstraction.
- [x] Implement notification record creation, retrieval, and saving.
- [x] Validate notification records and state transitions.
- [x] Add automated notification storage tests.
- [ ] Connect notification storage to Google Apps Script PropertiesService.
- [ ] Add concurrency control for notification processing.
- [ ] Integrate notification state management into the attendance workflow.
- [ ] Develop adapters for real Google service integration.
- [ ] Add sanitized Apps Script source code to the repository.
- [ ] Implement safe notification recovery and reconciliation.
- [ ] Improve synchronization delay handling.
- [ ] Configure and validate scheduled execution.
- [ ] Improve monitoring and error handling.

## 15. License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

**PontoGuard** is an ongoing portfolio project focused on practical software development, problem-solving, code quality, automated testing, and reliable automation.