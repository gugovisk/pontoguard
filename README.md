
# PontoGuard

**Attendance Receipt Verification and Notification System**

PontoGuard is a personal automation project designed to help verify attendance punch receipts, identify potentially missing records, and notify the user when manual verification may be necessary.

The project is being developed as a software engineering portfolio project, with a focus on JavaScript, modular architecture, automated testing, version control, continuous integration, and service automation.

## 1. Problem Statement

Attendance systems may generate individual proof files for each recorded punch. Keeping track of these files manually can make it difficult to identify missing records.

PontoGuard aims to simplify this process by analyzing the timestamps embedded in receipt filenames and counting unique records associated with each workday.

The project's initial business rule expects four attendance receipts per working day.

PontoGuard is a personal reminder tool. It does not replace an official attendance system or guarantee payroll accuracy.

## 2. Project Status

The project has two development areas: the JavaScript core maintained in this repository and a separate Google Apps Script integration prototype.

### Implemented in this repository

- [x] Filename timestamp parsing
- [x] Unix timestamp conversion (milliseconds)
- [x] `America/Sao_Paulo` timezone handling
- [x] Receipt grouping by date
- [x] Duplicate detection using JavaScript `Set`
- [x] Invalid filename handling
- [x] Automated unit tests
- [x] GitHub Actions continuous integration

### Validated separately in Google Apps Script

- [x] Google Drive folder reading using `DriveApp`
- [x] Google Calendar day-off lookup using `CalendarApp`
- [x] Telegram Bot API message delivery
- [x] Historical integrated validation scenarios

**Important:** The Apps Script implementation currently resides in a separate personal project and has not yet been added to this repository.

### Not yet in production

- [ ] Scheduled daily execution
- [ ] Automatic recovery from delayed file synchronization
- [ ] Versioned and sanitized Apps Script source
- [ ] Automated integration tests for external Google and Telegram services
- [ ] Production monitoring and error handling improvements

The daily trigger has not been activated. Therefore, the complete scheduled workflow should be considered a development prototype rather than a production service.

## 3. How It Works

The intended operational workflow is:

1. Attendance receipt images are stored on an Android device.
2. FolderSync transfers the files to a configured Google Drive folder.
3. Google Apps Script reads the filenames from the Drive folder.
4. The timestamp embedded in each valid filename is extracted.
5. Timestamps are converted into dates using the `America/Sao_Paulo` timezone.
6. Google Calendar is checked for a day-off event titled `Folga`.
7. Unique receipts are counted for the analyzed workday.
8. If fewer than four receipts are found on a working day, the system can send a Telegram reminder.

The system uses the filename as its source of timestamp information. It does not depend on image recognition, OCR, or image metadata.

## 4. Business Rules

The initial implementation follows these rules:

| Rule | Description |
|---|---|
| Filename format | `Comprovante_Ponto_Mobile_TIMESTAMP` |
| Timestamp | 13-digit Unix timestamp in milliseconds |
| Timezone | `America/Sao_Paulo` |
| Supported extensions | JPG, JPEG, PNG and WEBP |
| Duplicate detection | Identical timestamps count only once |
| Invalid filenames | Ignored and counted separately |
| Day-off identification | Default Google Calendar event titled `Folga` |
| Expected receipts | Four unique receipts per working day |
| Notification condition | Fewer than four receipts on a working day |

The expected quantity is an initial project rule and can be made configurable in a future improvement.

## 5. Core Architecture

The Node.js core is organized into separate modules.

### Filename Parser

The `parseFilename()` function validates a receipt filename, extracts its timestamp, and converts it into a date and time.

Example filename:

`Comprovante_Ponto_Mobile_1770416909454.jpg`

Expected output:

```json
{
  "timestamp": 1770416909454,
  "date": "2026-02-06",
  "time": "19:28:29"
}
```

The parser supports:

- JPG
- JPEG
- PNG
- WEBP

All date and time conversions use the `America/Sao_Paulo` timezone.

### Receipt Summarization

The `summarizeReceipts()` function processes a list of filenames and produces a summary containing:

- `byDate`: number of unique receipts grouped by date.
- `totalReceipts`: total number of unique valid receipts.
- `ignoredFiles`: number of invalid filenames.
- `duplicateFiles`: number of repeated timestamps.

Duplicate detection is implemented using JavaScript's built-in `Set` data structure.

Example:

Three files containing two distinct timestamps result in two unique receipts and one duplicate.

## 6. Technologies

| Technology | Purpose |
|---|---|
| JavaScript (ES Modules) | Application logic |
| Node.js | Runtime environment |
| Node.js Test Runner | Automated unit tests |
| Git | Version control |
| GitHub | Source code repository |
| GitHub Actions | Continuous integration |
| Google Apps Script | External service automation prototype |
| Google Drive Services | Receipt file access |
| Google Calendar Services | Day-off verification |
| Telegram Bot API | Notification delivery |
| FolderSync | Android-to-Drive file synchronization |

The Node.js core does not require external npm dependencies.

Google Apps Script runs in a separate environment and is not imported directly into the Node.js modules.

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

### Main directories

| Directory | Responsibility |
|---|---|
| `src/` | Application source code |
| `tests/` | Automated test cases |
| `.github/workflows/` | Continuous integration configuration |

## 8. Requirements

- Node.js 20 or later
- npm
- Git (optional for local development)

The GitHub Actions workflow currently uses Node.js 22.

No additional npm packages are required to run the current test suite.

## 9. Running Automated Tests

To execute the test suite in a Node.js environment:

Clone the repository:

```bash
git clone https://github.com/gugovisk/pontoguard.git
```

Enter the project directory:

```bash
cd pontoguard
```

Run the tests:

```bash
npm test
```

The project uses Node.js's built-in Test Runner and the `node:assert/strict` module.

The test suite covers scenarios such as:

- Valid and invalid filenames
- Timestamp extraction
- Timezone conversion
- Different receipt dates
- Receipt grouping
- Empty input lists
- Invalid input types
- Duplicate timestamps
- Invalid file counting

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

This helps identify regressions before changes are incorporated into the main branch.

## 11. Security and Privacy

Security and privacy are important considerations because the project handles personal attendance information.

The public repository must never contain:

- Real attendance receipt images
- Telegram bot tokens
- Telegram chat IDs
- Private Google Drive folder identifiers
- Google account credentials
- Personal attendance records
- Other sensitive personal information

External service credentials should be stored outside the source code, using secure configuration mechanisms such as Google Apps Script Script Properties.

Only sanitized examples and test fixtures should be committed to this repository.

## 12. Current Limitations

The current implementation has some known limitations:

- The core parser depends on the expected filename convention.
- The core does not inspect image contents.
- The Apps Script prototype currently uses the default Google Calendar.
- File synchronization delays may cause temporary undercounting.
- The scheduled daily trigger has not been activated.
- External service integration code is not yet versioned in this repository.

These limitations are being addressed incrementally as part of the development roadmap.

## 13. Development Roadmap

- [x] Develop the filename parser.
- [x] Implement receipt grouping by date.
- [x] Implement duplicate timestamp detection.
- [x] Create automated unit tests.
- [x] Configure GitHub Actions.
- [x] Validate Google Drive, Calendar and Telegram integrations separately.
- [ ] Add a sanitized Apps Script implementation to the repository.
- [ ] Improve synchronization delay handling.
- [ ] Expand automated test coverage.
- [ ] Configure and validate scheduled execution.
- [ ] Improve monitoring and operational error handling.

## 14. License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

**PontoGuard** is an ongoing learning and portfolio project focused on practical software development, problem-solving, code quality, and automation.