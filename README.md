
# PontoGuard

**Attendance Receipt Verification and Reminder Automation**

PontoGuard is a personal automation and software portfolio project designed to verify attendance punch receipts, identify potentially missing records, and notify the user when manual verification may be necessary.

The project combines a modular JavaScript/Node.js core, automated testing, Google Apps Script integrations, Google Drive, Google Calendar, Telegram, and GitHub Actions.

## 1. Project Objective

The system is designed to:

1. Read attendance receipt filenames stored in Google Drive.
2. Extract 13-digit Unix timestamps in milliseconds from filenames.
3. Convert timestamps into dates and times using the `America/Sao_Paulo` timezone.
4. Count unique receipts for each workday.
5. Check Google Calendar for scheduled days off.
6. Send a Telegram reminder when fewer than four unique receipts are found on a working day.

Filenames are the source of timestamp information. The system does not depend on image metadata or image recognition.

PontoGuard is a personal reminder tool. It does not replace an official attendance management system.

## 2. Project Status

**Current stage: Core and Apps Script integration implemented; PG-025 manual test suites passed (27/27); Drive synchronization spot-check completed; daily trigger installed; three automatic executions on working days confirmed receipt counting and successful Telegram delivery, alongside two day-off skips. Broader reliability and synchronization timing remain under observation.**

### Implemented in the GitHub repository

- [x] Filename timestamp parser.
- [x] Unix timestamp conversion and `America/Sao_Paulo` timezone handling.
- [x] Receipt grouping by date.
- [x] Duplicate timestamp detection.
- [x] Invalid filename handling.
- [x] Attendance reminder decision rules.
- [x] Workflow orchestration with injected dependencies.
- [x] Simulated workflow and resilience tests.
- [x] Notification lifecycle state machine.
- [x] Notification state transition validation.
- [x] Abstract persistent notification store with injectable adapter.
- [x] Automated Node.js test suite.
- [x] GitHub Actions continuous integration.
- [x] Sanitized Google Apps Script source code in `apps-script/Code.gs`.

### Implemented and manually validated in Google Apps Script

- [x] Google Drive folder reading.
- [x] Receipt counting by date and timestamp deduplication.
- [x] Google Calendar day-off verification.
- [x] Telegram Bot API message delivery.
- [x] Integrated historical verification scenarios.
- [x] Persistent notification records using `PropertiesService`.
- [x] Notification states and guarded transitions.
- [x] Manual reconciliation of uncertain notification results.
- [x] Execution locking using `LockService`.
- [x] Concurrent execution test using two independent Apps Script executions.
- [x] PG-025 manual Apps Script test suites: 27/27 passed (state transitions, receipt counting, day-off rules, and integrated simulated workflows).
- [x] Drive folder spot-check on 2026-11-23: 119 unique valid receipts across 42 dates; zero ignored files and zero duplicate timestamps.
- [x] FolderSync-to-Drive spot-check: the three receipt files present for 2026-11-22 on the phone were also present in the configured Drive folder.

### Current validation evidence

- The Node.js suite reported **60 passing tests** during the PG-021 integration work and subsequent pull request checks.
- Apps Script storage and notification transition tests were manually executed and reported as approved.
- The `LockService` acquisition/release test was approved.
- The PG-024 concurrency test was manually performed with two independent executions: execution A acquired and held the script lock; execution B failed to acquire it within its configured three-second wait. Temporary test properties were then removed.
- These manual Apps Script checks are not part of the GitHub Actions test suite.
- Automatic operational runs shown in the Apps Script execution log: 2026-11-24 processed 2026-11-23 and correctly skipped a day off; 2026-11-25 processed 2026-11-24 and skipped a day off; 2026-11-26 processed 2026-11-25 and found 3 unique receipts (0 duplicates, 0 ignored files), then logged successful Telegram delivery (`SENT`, 1 attempt); 2026-11-27 processed 2026-11-26 and again found 3 unique receipts (0 duplicates, 0 ignored files), then logged successful Telegram delivery (`SENT`, 1 attempt). The day-off runs correctly stopped before Drive counting.
- The screenshot evidence confirms two consecutive successful reminder deliveries on working days; the repeated run sequence now provides more than one automatic trigger execution, but does not establish long-term reliability.

### Not yet completed

- [x] Review the first automatic execution log: the run processed 2026-11-23, identified it as a day off, skipped the reminder workflow, and released the execution lock. Because the day-off rule short-circuited the workflow, no Drive receipt count or Telegram decision was expected for this run.
- [ ] Evaluate FolderSync delays over multiple workdays; the 2026-11-22 check is a single spot-check, not a timing/reliability study.
- [ ] Operational monitoring and alerting improvements.
- [ ] Automated CI coverage for real Google and Telegram service integrations.
- [ ] Load and failure testing beyond the controlled two-execution lock test.
- [ ] Full integration of the Node.js core workflow with real Google service adapters.

**Important:** The daily time-driven trigger is installed and has completed multiple automatic executions. Two consecutive working-day runs confirmed Drive counting and Telegram delivery, while day-off runs skipped reminders. This is meaningful operational evidence, but does not establish long-term reliability, FolderSync timing guarantees, or complete production readiness.

## 3. How It Works

The intended operational workflow is:

1. Attendance receipt images are stored on an Android device.
2. FolderSync synchronizes the files with Google Drive.
3. Google Apps Script reads filenames from the configured Drive folder.
4. The timestamp embedded in each filename is extracted.
5. Timestamps are converted into dates using `America/Sao_Paulo`.
6. Google Calendar is checked for a day-off event titled `Folga`.
7. Unique receipts are counted for the analyzed workday.
8. If fewer than four receipts are found on a working day, the system can send a Telegram reminder.
9. Notification state is persisted to prevent unsafe repeated sends and to support manual reconciliation.
10. A daily time-driven Apps Script trigger invokes the protected entry point. The Apps Script trigger screen displayed the execution window as 00:00–01:00 (`GMT-03:00`). The first automatic execution occurred on 2026-11-24 at 00:19:47 and processed 2026-11-23; subsequent executions on 2026-11-25, 2026-11-26, and 2026-11-27 processed the previous calendar dates. The 2026-11-25 run (processing 2026-11-24) and 2026-11-24 run (processing 2026-11-23) identified days off and skipped reminders. The 2026-11-26 run (processing 2026-11-25) and 2026-11-27 run (processing 2026-11-26) each counted three unique receipts and logged successful Telegram delivery with state `SENT` and one attempt. The entry point resolves midnight runs to the previous calendar date.

The Apps Script checks the day-off condition before processing receipts. The production entry point uses a script lock so simultaneous executions do not process the protected operation at the same time.

The Node.js core separately implements the parser, receipt summary, decision rules, workflow orchestration, notification state machine, and an adapter-based notification store.

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

Supported extensions: JPG, JPEG, PNG, and WEBP.

Example:

`Comprovante_Ponto_Mobile_1770416909454.jpg`

All date and time conversions use the `America/Sao_Paulo` timezone.

### Receipt Summarization

The `summarizeReceipts()` function processes a list of filenames and produces:

- `byDate`: number of unique receipts grouped by date.
- `totalReceipts`: total number of unique valid receipts.
- `ignoredFiles`: number of invalid filenames.
- `duplicateFiles`: number of repeated timestamps.

Duplicate detection uses JavaScript's built-in `Set` data structure.

### Attendance Reminder Rules and Workflow

The attendance rules determine whether a reminder is necessary based on:

- The number of unique attendance receipts.
- Whether the analyzed day is a day off.
- The expected minimum number of receipts.

The workflow coordinates attendance verification through injected dependencies. This makes it possible to test normal and failure scenarios with simulated services instead of making real API requests.

### Notification State Machine

The notification lifecycle uses four states:

| State | Description |
|---|---|
| `SENDING` | Notification delivery has started |
| `SENT` | Notification delivery was confirmed |
| `FAILED` | Delivery failure was confirmed |
| `UNKNOWN` | Delivery result is uncertain |

The transition rules include:

| Current state | Next state | Allowed |
|---|---|---|
| New notification | `SENDING` | Yes |
| `SENDING` | `SENT` | Yes |
| `SENDING` | `FAILED` | Yes |
| `SENDING` | `UNKNOWN` | Yes |
| `FAILED` | `SENDING` | Yes |
| `UNKNOWN` | `SENT` | Yes, after reconciliation |
| `UNKNOWN` | `FAILED` | Yes, after reconciliation |
| `SENT` | `SENDING` | No |
| `UNKNOWN` | `SENDING` | No |

An uncertain delivery must be reconciled before another sending attempt.

### Notification Store in the Node.js Core

`src/notificationStore.js` provides an adapter-based notification record store. It validates records and state transitions while allowing the storage mechanism to be injected.

The automated tests use an in-memory adapter. This Node.js abstraction is separate from the Google Apps Script persistence implementation.

### Google Apps Script Persistence and Concurrency

The Apps Script integration uses:

- `PropertiesService` to persist notification records.
- A per-date notification record to track delivery state and attempts.
- Guarded state transitions and manual reconciliation for uncertain outcomes.
- `LockService.getScriptLock()` to protect the daily conference and manual reconciliation entry points.
- `tryLock()` and `finally` blocks to acquire and reliably release the lock.

The PG-024 manual concurrency test used two independent Apps Script executions. Execution A acquired and held the script lock. Execution B attempted to acquire the same lock while A held it and was refused within the configured timeout.

This validates the tested mutual-exclusion behavior. It does not replace broader load testing or end-to-end production validation.

## 6. Technologies

| Technology | Purpose |
|---|---|
| JavaScript (ES Modules) | Application logic |
| Node.js | Core runtime |
| Node.js Test Runner | Automated unit testing |
| Git | Version control |
| GitHub | Source code hosting |
| GitHub Actions | Continuous integration |
| Google Apps Script | External service automation |
| Google Drive Services | Receipt file access |
| Google Calendar Services | Day-off verification |
| PropertiesService | Apps Script notification persistence |
| LockService | Apps Script execution locking |
| Telegram Bot API | User notifications |
| FolderSync | Android-to-Drive synchronization |

The Node.js core does not require external npm dependencies.

## 7. Project Structure

```text
pontoguard/
│
├── .github/
│   └── workflows/
│       └── tests.yml
│
├── apps-script/
│   ├── Code.gs
│   └── PG025_Tests.gs
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
| `src/filenameParser.js` | Filename validation and timestamp extraction |
| `src/driveService.js` | Receipt summarization and duplicate detection |
| `src/attendanceRules.js` | Attendance reminder decision rules and input validation |
| `src/attendanceWorkflow.js` | Attendance verification orchestration using injected dependencies |
| `src/notificationState.js` | Notification states and transition validation |
| `src/notificationStore.js` | Adapter-based notification record storage |
| `tests/` | Automated Node.js tests |
| `apps-script/Code.gs` | Google Apps Script integration |
| `.github/workflows/tests.yml` | GitHub Actions test workflow |

## 8. Requirements

- Node.js 20 or later.
- npm.
- Git (optional for local development).

The GitHub Actions workflow currently uses Node.js 22.

No external npm dependencies are required to run the current Node.js test suite.

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

### Automated Test Coverage

The Node.js suite reported 60 passing tests during the latest completed validation cycle.

Coverage includes:

- Valid and invalid filenames.
- Timestamp extraction and timezone conversion.
- Receipt grouping and duplicate timestamp detection.
- Attendance reminder rules and day-off handling.
- Simulated workflow success and failure scenarios.
- Notification state transitions.
- Notification record creation, retrieval, persistence through an injected adapter, and invalid record handling.

The automated Node.js tests use isolated functions and simulated dependencies. They do not make real Google Drive, Google Calendar, or Telegram API requests.

Apps Script manual tests are performed separately in the Google Apps Script editor and are not counted as Node.js automated tests.

## 10. Continuous Integration

PontoGuard uses GitHub Actions to execute automated tests.

The workflow is defined in:

`.github/workflows/tests.yml`

It runs when changes are pushed to the `main` branch or when a pull request targets `main`.

The workflow checks out the repository, sets up Node.js 22, and executes `npm test`.

## 11. Google Apps Script Configuration

The sanitized production source and PG-025 manual test suite are versioned at:

- `apps-script/Code.gs`
- `apps-script/PG025_Tests.gs`

The deployed Apps Script project uses Script Properties for sensitive configuration. The actual values must remain outside the public repository.

Expected property names include:

- `FOLDER_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Do not commit real values, tokens, chat identifiers, private folder IDs, or personal attendance data.

The source code reads configuration from Script Properties. A daily time-driven trigger for `conferirPontoDiario` was installed on 2026-11-23. The installation log confirmed trigger creation and that zero previous triggers for this handler were removed. The Apps Script trigger screen displayed its execution window as 00:00–01:00 (`GMT-03:00`). The first automatic execution was confirmed on 2026-11-24 at 00:19:47, with the routine processing 2026-11-23. The exact business outcome of that run still needs to be recorded from its execution log.

## 12. Security and Privacy

The public repository must never contain:

- Real attendance receipt images.
- Telegram bot tokens.
- Telegram chat IDs.
- Private Google Drive folder identifiers.
- Google account credentials.
- Personal attendance records.
- Other sensitive personal information.

External service credentials must be stored outside source code, using secure configuration mechanisms such as Google Apps Script Script Properties.

Only sanitized source code, examples, and test fixtures should be committed.

## 13. Current Limitations

Known limitations include:

- The core parser depends on the expected filename convention.
- The Node.js core does not inspect image contents.
- The Apps Script integration currently uses the default Google Calendar.
- Delayed FolderSync uploads may temporarily cause an undercount.
- The Node.js workflow is not yet connected to real Google service adapters.
- The Node.js notification store uses an injected adapter; its tests use an in-memory implementation.
- The Apps Script integration has separate persistence and locking logic.
- The manual concurrency test validates a controlled two-execution scenario, not high-load behavior.
- Uncertain Telegram delivery results require reconciliation before retrying.
- Multiple automatic trigger executions have been confirmed, including two consecutive working-day runs with successful Telegram delivery; longer-term reliability and FolderSync timing still require monitoring.
- Real external service integrations do not yet have automated CI coverage.
- Full end-to-end production behavior has not yet been validated.

## 14. Development Roadmap

### Completed

- [x] Develop the filename parser.
- [x] Implement receipt grouping by date.
- [x] Implement duplicate timestamp detection.
- [x] Create automated unit tests.
- [x] Configure GitHub Actions.
- [x] Implement attendance reminder decision rules.
- [x] Implement workflow orchestration with injected dependencies.
- [x] Add simulated workflow and resilience tests.
- [x] Define notification lifecycle states.
- [x] Validate permitted notification state transitions.
- [x] Add automated notification state tests.
- [x] Implement the adapter-based Node.js notification store (PG-021).
- [x] Implement Apps Script notification persistence with PropertiesService (PG-022).
- [x] Add LockService protection to Apps Script entry points (PG-023).
- [x] Version the sanitized Apps Script integration in the repository.
- [x] Perform a controlled two-execution concurrency test (PG-024).
- [x] Add PG-025 Apps Script manual test suite and record 27 passing scenarios.
- [x] Verify a real Drive folder listing and a FolderSync synchronization spot-check.
- [x] Install the daily time-driven trigger for `conferirPontoDiario`.
- [x] Confirm the first automatic execution on 2026-11-24 at 00:19:47, processing the previous date (2026-11-23).
- [x] Confirm subsequent automatic executions on 2026-11-25 and 2026-11-26 correctly skipped day-off reminders.
- [x] Confirm automatic working-day executions on 2026-11-26 and 2026-11-27 each counted three unique receipts and logged successful Telegram delivery (`SENT`, one attempt).

### Pending

- [ ] Perform broader concurrency and failure testing.
- [ ] Complete end-to-end validation with real services.
- [ ] Evaluate FolderSync synchronization delays and define a safe verification window.
- [ ] Improve operational monitoring and error handling.
- [ ] Monitor the trigger and FolderSync behavior across multiple workdays.
- [ ] Expand automated testing for external service integrations.
- [ ] Evaluate future integration of the Node.js workflow with real Google service adapters.


## 15. License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

**PontoGuard** is an ongoing portfolio project focused on practical software development, problem-solving, code quality, automated testing, and reliable automation.
