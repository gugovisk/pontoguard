# PontoGuard

Automated Attendance Receipt Verification and Notification System

PontoGuard is a personal automation and software portfolio project designed to verify attendance punch receipts, identify potentially missing records, and notify the user when manual verification may be necessary.

The project combines a modular JavaScript core, automated tests, GitHub Actions, Google Apps Script, Google Drive, Google Calendar, FolderSync, and Telegram notifications.

## 1. Project Objective

The system is designed to:

1. Read attendance receipt filenames stored in Google Drive.
2. Extract 13-digit Unix timestamps in milliseconds.
3. Convert timestamps using the `America/Sao_Paulo` timezone.
4. Count unique receipts for each workday.
5. Check Google Calendar for a day-off event titled `Folga`.
6. Send a Telegram reminder when fewer than four unique receipts are found on a working day.

Filenames are the source of timestamp information. The system does not depend on image metadata or image recognition.

PontoGuard is a personal reminder tool. It does not replace an official attendance management system.

## 2. Current Project Status

**Current stage:** JavaScript core implemented and tested; Google Apps Script integration manually validated and versioned; production scheduling remains disabled.

### Implemented in the GitHub repository

- Filename parsing and timestamp conversion.
- Timezone-aware date and time extraction.
- Receipt grouping by date.
- Duplicate timestamp detection.
- Attendance reminder decision rules.
- Workflow orchestration using injected dependencies.
- Notification state machine (`SENDING`, `SENT`, `FAILED`, `UNKNOWN`).
- Persistent notification store abstraction with injectable storage adapter.
- Automated unit and workflow tests.
- GitHub Actions continuous integration.

The Node.js test suite has **60 passing tests**, as confirmed during project development.

### Implemented and manually tested in Google Apps Script

- Reading receipt filenames from Google Drive.
- Counting unique receipts by date.
- Checking day-off events in Google Calendar.
- Sending a test message through the Telegram Bot API.
- Persistent notification records using `PropertiesService`.
- Notification state transitions and manual reconciliation.
- Execution locking using `LockService`.

Apps Script tests are manual tests executed in the Google Apps Script editor. They are not part of the Node.js GitHub Actions test suite.

### Not yet completed or enabled

- Automated end-to-end tests against real Google and Telegram services.
- A dedicated concurrent-execution stress test.
- Validation of delayed FolderSync uploads and a suitable late-check strategy.
- Activation and production validation of the daily trigger.
- Operational monitoring and alerting.
- A complete production run under normal working conditions.

**Important:** The daily trigger remains disabled. Passing isolated storage, state-transition, and lock acquisition/release tests does not by itself establish production readiness.

## 3. How It Works

The intended operational flow is:

1. Attendance receipt images are saved on an Android device.
2. FolderSync synchronizes the files with Google Drive.
3. Google Apps Script reads filenames from the configured Drive folder.
4. The timestamp in each filename is extracted and converted to a local date.
5. Google Calendar is checked for an event titled `Folga`.
6. If the day is not a day off, unique receipts are counted.
7. If fewer than four receipts are found, the notification state is checked.
8. If sending is allowed, a reminder is sent through Telegram and the result is recorded.

The day-off check occurs before receipt processing in the Apps Script flow.

The Node.js core is maintained separately from the Apps Script integration. Its injected dependencies allow external services to be simulated in automated tests.

## 4. Business Rules

| Rule | Description |
|---|---|
| Filename pattern | `Comprovante_Ponto_Mobile_TIMESTAMP` |
| Timestamp | 13-digit Unix timestamp in milliseconds |
| Timezone | `America/Sao_Paulo` |
| Supported extensions | JPG, JPEG, PNG, WEBP |
| Duplicate detection | Identical timestamps count only once |
| Day-off identification | Default Google Calendar event titled `Folga` |
| Expected receipts | Four unique receipts per working day |
| Notification condition | Fewer than four receipts on a working day |

The expected receipt count is a configurable business rule.

## 5. JavaScript Core

The Node.js core is organized into small modules:

- `filenameParser.js`: validates filenames and extracts timestamps.
- `driveService.js`: summarizes receipts and detects duplicate timestamps.
- `attendanceRules.js`: evaluates whether a reminder is necessary.
- `attendanceWorkflow.js`: coordinates the verification flow through injected dependencies.
- `notificationState.js`: defines allowed notification state transitions.
- `notificationStore.js`: provides a persistent-store abstraction through an injected adapter.

### Notification states

| Current state | Allowed next state | Meaning |
|---|---|---|
| `NEW` | `SENDING` | A notification attempt is starting |
| `SENDING` | `SENT` | Delivery was confirmed |
| `SENDING` | `FAILED` | A failure was confirmed |
| `SENDING` | `UNKNOWN` | The result could not be determined |
| `FAILED` | `SENDING` | A new attempt is allowed |
| `UNKNOWN` | `SENT` or `FAILED` | Manual reconciliation is required |
| `SENT` | None | Terminal state; no automatic resend |

The notification store uses an injectable adapter. Its Node.js tests use an in-memory implementation. The Google Apps Script integration separately persists records through `PropertiesService`.

## 6. Google Apps Script Integration

The Apps Script implementation is stored in:

```text
apps-script/
└── Code.gs
```

It integrates the Google services and Telegram:

- `DriveApp` reads receipt filenames.
- `CalendarApp` checks day-off events.
- `PropertiesService` stores configuration and notification records.
- `LockService` prevents overlapping executions of the protected entry points.
- `UrlFetchApp` communicates with the Telegram Bot API.

### Persistent notification records

The Apps Script implementation stores one notification record per date in Script Properties. Records include the schema version, date, status, attempt count, timestamps, and last error.

The implementation avoids automatic retries when the previous result is `UNKNOWN`. The user must first inspect Telegram and reconcile the record as `SENT` or `FAILED`.

### Execution locking

The entry points `conferirPontoDiario()` and `reconciliarNotificacao()` use a script lock. If the lock cannot be acquired within the configured wait period, the operation is not processed.

The current lock test verifies acquisition and release. A separate concurrent-execution test remains outstanding.

### Script Properties and secrets

The following values must be configured in Google Apps Script **Project Settings → Script Properties** and must never be committed to this repository:

- `FOLDER_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Do not place real receipt images, personal attendance records, credentials, or private identifiers in the repository.

### Scheduling status

The daily time-driven trigger has **not** been activated. Production scheduling must remain disabled until synchronization timing, recovery behavior, and end-to-end operation have been reviewed.

## 7. Repository Structure

```text
pontoguard/
├── .github/
│   └── workflows/
│       └── tests.yml
├── apps-script/
│   └── Code.gs
├── src/
│   ├── filenameParser.js
│   ├── driveService.js
│   ├── attendanceRules.js
│   ├── attendanceWorkflow.js
│   ├── notificationState.js
│   └── notificationStore.js
├── tests/
│   ├── filenameParser.test.js
│   ├── driveService.test.js
│   ├── attendanceRules.test.js
│   ├── attendanceWorkflow.test.js
│   ├── notificationState.test.js
│   └── notificationStore.test.js
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## 8. Technologies

| Technology | Purpose |
|---|---|
| JavaScript (ES Modules) | Core application logic |
| Node.js | Runtime and automated test execution |
| Node.js Test Runner | Unit and workflow tests |
| Git and GitHub | Version control and source hosting |
| GitHub Actions | Continuous integration |
| Google Apps Script | External service integration |
| Google Drive | Receipt file storage |
| Google Calendar | Day-off verification |
| Google Apps Script PropertiesService | Configuration and notification persistence |
| Google Apps Script LockService | Execution locking |
| Telegram Bot API | User notifications |
| FolderSync | Android-to-Drive synchronization |

The Node.js core does not require external npm dependencies.

## 9. Requirements and Automated Testing

For the Node.js core:

- Node.js 20 or later.
- npm.

Run the test suite with:

```bash
npm test
```

GitHub Actions currently uses Node.js 22 and runs the automated test suite for pushes to `main` and pull requests targeting `main`.

The automated tests cover filename parsing, receipt summaries, decision rules, workflow orchestration, notification state transitions, and notification-store behavior.

The Apps Script code runs in Google's Apps Script environment and is validated separately through manual test functions in the editor.

## 10. Security and Privacy

The public repository must never contain:

- Telegram bot tokens.
- Telegram chat IDs.
- Private Google Drive folder identifiers.
- Google account credentials.
- Real attendance receipt images.
- Personal attendance records.
- Other sensitive personal information.

Apps Script credentials and private identifiers must remain in Script Properties. Only sanitized source code and non-sensitive test fixtures belong in GitHub.

## 11. Current Limitations and Risks

- The parser depends on the expected filename convention.
- The Node.js core does not inspect image contents.
- The Apps Script integration uses the default Google Calendar.
- Delayed FolderSync uploads may temporarily cause an undercount.
- Node.js adapters are not yet connected to the real Google services.
- Apps Script manual tests are not executed by GitHub Actions.
- The lock acquisition test does not replace a concurrent-execution stress test.
- A production trigger has not been enabled.
- Real external service integrations do not yet have automated end-to-end CI coverage.

These limitations are tracked as part of the development roadmap.

## 12. Development Roadmap

- [x] Implement filename parsing and timezone conversion.
- [x] Implement receipt grouping and duplicate detection.
- [x] Implement attendance reminder rules and workflow orchestration.
- [x] Add automated tests and GitHub Actions.
- [x] Implement notification state machine in the Node.js core.
- [x] Implement the persistent notification-store abstraction in the Node.js core.
- [x] Integrate notification persistence with Apps Script `PropertiesService`.
- [x] Add Apps Script notification state transitions and manual reconciliation.
- [x] Add `LockService` to the protected Apps Script entry points.
- [x] Add the sanitized Apps Script source to the repository.
- [ ] Add a concurrent-execution stress test.
- [ ] Evaluate FolderSync delays and define a late-check strategy.
- [ ] Expand real-service and end-to-end validation.
- [ ] Review operational monitoring and error recovery.
- [ ] Configure and validate the daily trigger only after the preceding checks.

## 13. License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

PontoGuard is an ongoing portfolio project focused on practical software development, problem-solving, code quality, automated testing, and personal workflow automation.
