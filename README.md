
# PontoGuard

**Automated Attendance Receipt Verification and Notification System**

PontoGuard is a personal automation project designed to verify attendance punch receipts, identify potentially missing records, and notify the user when manual verification may be necessary.

The project combines JavaScript, automated testing, Google Apps Script, Google services, and Telegram notifications.

It is also a practical software development portfolio project focused on modular architecture, testing, continuous integration, and real-world automation.

## 1. Project Objective

The main objective is to automate the verification of attendance punch receipts stored in Google Drive.

The system is designed to:

1. Read attendance receipt filenames.
2. Extract Unix timestamps in milliseconds.
3. Convert timestamps into dates and times using the `America/Sao_Paulo` timezone.
4. Count unique receipts associated with each workday.
5. Check scheduled days off using Google Calendar.
6. Notify the user through Telegram when fewer than four receipts are found on a working day.

The system uses filenames as its source of timestamp information, without relying on image metadata or image recognition.

PontoGuard is a personal reminder tool. It does not replace an official attendance management system.

## 2. Project Status

**Current stage: Core development and integration prototype.**

### Implemented in the GitHub repository

- [x] Filename timestamp parser
- [x] Unix timestamp conversion
- [x] `America/Sao_Paulo` timezone handling
- [x] Receipt grouping by date
- [x] Duplicate timestamp detection
- [x] Invalid filename handling
- [x] Automated unit tests
- [x] GitHub Actions continuous integration

### Validated separately using Google Apps Script

- [x] Google Drive folder reading
- [x] Receipt counting and timestamp deduplication
- [x] Google Calendar day-off verification
- [x] Telegram Bot API message delivery
- [x] Integrated historical validation scenarios

### Not yet enabled or completed

- [ ] Add sanitized Apps Script source code to this repository
- [ ] Configure the automatic daily trigger
- [ ] Improve handling of delayed file synchronization
- [ ] Expand automated integration test coverage
- [ ] Implement additional monitoring and operational safeguards

**Important:** The Google Apps Script implementation currently resides in a separate personal project. The daily scheduled execution has not been activated. External integrations have been validated manually, but the complete automated workflow is not yet running in production.

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

The system checks the day-off condition before processing receipts.

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
│   └── driveService.js
│
├── tests/
│   ├── filenameParser.test.js
│   └── driveService.test.js
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
| `filenameParser.test.js` | Parser unit tests |
| `driveService.test.js` | Receipt processing unit tests |
| `tests.yml` | GitHub Actions workflow |

## 8. Requirements

- Node.js 20 or later
- npm
- Git (optional for local development)

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

The test suite covers:

- Valid and invalid filenames.
- Timestamp extraction.
- Timezone conversion.
- Receipt grouping by date.
- Different receipt dates.
- Empty input lists.
- Invalid input types.
- Duplicate timestamps.
- Invalid file counting.

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

## 11. Security and Privacy

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

Only sanitized examples and test fixtures should be committed to the repository.

## 12. Current Limitations

The current implementation has some known limitations:

- The core parser depends on the expected filename convention.
- The Node.js core does not inspect image contents.
- The Apps Script prototype currently uses the default Google Calendar.
- Delayed file synchronization may temporarily cause an undercount.
- The daily scheduled trigger has not been activated.
- The Apps Script source is not yet versioned in this repository.
- External service integrations do not yet have automated CI coverage.

These limitations are being addressed incrementally.

## 13. Development Roadmap

- [x] Develop the filename parser.
- [x] Implement receipt grouping by date.
- [x] Implement duplicate timestamp detection.
- [x] Create automated unit tests.
- [x] Configure GitHub Actions.
- [x] Validate Google Drive integration separately.
- [x] Validate Google Calendar day-off lookup.
- [x] Validate Telegram notifications.
- [ ] Add sanitized Apps Script source code to the repository.
- [ ] Improve synchronization delay handling.
- [ ] Expand automated integration test coverage.
- [ ] Configure and validate scheduled execution.
- [ ] Improve monitoring and error handling.

## 14. License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

**PontoGuard** is an ongoing portfolio project focused on practical software development, problem-solving, code quality, and automation.
