
# PontoGuard

**Automated attendance proof verification system**

PontoGuard is a personal automation project designed to verify attendance punch receipts, identify missing records, and notify the user when manual verification may be necessary.

The project is being developed as a practical portfolio project focused on JavaScript, software testing, automation, and Google services integration.

## Project Status

**Current stage:** Core development

Implemented:
- [x] Filename timestamp parser
- [x] São Paulo timezone conversion
- [x] Automated unit tests
- [x] GitHub Actions CI workflow

Planned:
- [ ] Google Drive integration
- [ ] Google Calendar integration
- [ ] Daily attendance receipt validation
- [ ] Automated notifications
- [ ] Scheduled execution
- [ ] Integration testing

## Project Objective

The main objective is to automate the verification of attendance punch receipts stored in Google Drive.

The system is designed to:

1. Read receipt filenames.
2. Extract Unix timestamps in milliseconds.
3. Convert timestamps into dates and times using the `America/Sao_Paulo` timezone.
4. Count receipts associated with each workday.
5. Check scheduled days off using Google Calendar.
6. Notify the user when fewer than four receipts are found on a working day.

The system will use filenames as its source of date information, without relying on image metadata or image recognition.

## Technologies

| Technology | Purpose |
|---|---|
| JavaScript | Application logic |
| Node.js | Runtime and test execution |
| Node.js Test Runner | Automated unit testing |
| Git | Version control |
| GitHub | Source code hosting |
| GitHub Actions | Continuous Integration |
| Google Drive API | Planned file integration |
| Google Calendar API | Planned schedule integration |

## Current Features

### Filename Parser

The `parseFilename()` function extracts timestamp information from filenames following this pattern:

`Comprovante_Ponto_Mobile_TIMESTAMP.jpg`

Supported image extensions:
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

All dates and times are interpreted using the `America/Sao_Paulo` timezone.

## Project Structure

```text
pontoguard/
├── src/
│   └── filenameParser.js
├── tests/
│   └── filenameParser.test.js
├── .github/
│   └── workflows/
│       └── tests.yml
├── package.json
├── LICENSE
└── README.md
```

## Requirements

- Node.js 22 or compatible supported version
- npm
- Git (optional for local development)

No external npm dependencies are currently required.

## Installation

Clone the repository:

```bash
git clone https://github.com/gugovisk/pontoguard.git
```

Navigate to the project directory:

```bash
cd pontoguard
```

## Running Tests

Execute the automated tests:

```bash
npm test
```

The project uses the built-in Node.js Test Runner.

## Continuous Integration

GitHub Actions automatically executes the test suite when changes are pushed to the `main` branch or when a pull request targets `main`.

The workflow is defined in:

`.github/workflows/tests.yml`

## Development Principles

This project follows these principles:

- Separation of responsibilities
- Modular code organization
- Automated testing
- Version control with Git
- Continuous Integration
- Secure handling of personal information
- Incremental development

## Security and Privacy

This repository must never contain:

- Real attendance receipt images
- Personal account credentials
- Google API access tokens
- Private folder identifiers
- Sensitive personal information

## License

This project is licensed under the MIT License.
See the `LICENSE` file for details.
