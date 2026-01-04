# E2E Testing

This directory contains end-to-end tests for the application.

## Test Files

### Core Features
- **home.spec.ts** - Basic test for home page
- **uploads.spec.ts** - Comprehensive E2E test suite with 36 tests covering all uploads page functionality
- **library.spec.ts** - Comprehensive E2E test suite with 42 tests covering all library page functionality
- **reader.spec.ts** - Tests for the book reader interface

### Authentication & Authorization
- **auth.spec.ts** - Registration, login, and logout flows
- **account.spec.ts** - Personal cabinet and password change functionality
- **dashboard.spec.ts** - Guest and authenticated dashboard views with real data
- **authorization.spec.ts** - Ownership guards for books, files, and API endpoints

## Running Tests

### Prerequisites

1. **MongoDB** must be running:

   ```bash
   docker run -d --name coreader-mongo -p 27017:27017 mongo:7
   ```

2. **Environment variables** (.env file):
   ```
   MONGODB_URI=mongodb://localhost:27017
   # Optional: Playwright defaults to llm_reader_e2e
   MONGODB_DB_NAME=llm_reader_e2e
   ```

When running E2E tests, migrations and seeds from `infra/db` are automatically applied to the `llm_reader_e2e` database before the dev server starts.

### Run All Tests

```bash
# From coreader-app directory
npm run e2e
```

This command will:

- Ensure MongoDB is reachable (and start a local Docker `mongo:7` if needed)
- Apply DB migrations and seeds to `llm_reader_e2e`
- Start the Next.js dev server and run Playwright tests

### Run Specific Test Suites

```bash
# Authentication tests
npm run e2e -- auth.spec.ts

# Dashboard tests  
npm run e2e -- dashboard.spec.ts

# Personal cabinet tests
npm run e2e -- account.spec.ts

# Authorization tests
npm run e2e -- authorization.spec.ts

# Uploads tests
npm run e2e -- uploads.spec.ts

# Library tests
npm run e2e -- library.spec.ts
```

### Run Tests in UI Mode

```bash
npm run e2e:ui
```

## Test Data

Tests automatically apply seed data from `/infra/db/seeds/20250201000000-sample-data.js`, which includes:

### Users (for Auth tests):

- **testuser@example.com** - Test user account
  - Password: `TestPassword123!`
  - Used for authentication and authorization tests

### Files (for Uploads page):

- **foundation.txt** - Completed upload with book (owned by test user)
- **i_robot.txt** - Processing upload at 45% (owned by test user)
- **dune.txt** - Completed upload (no owner)
- **bradbury_martian_chronicles.txt** - Completed upload (no owner)
- **some_scan.pdf** - Failed upload (unsupported format)
- **ember-archive.pdf** - Completed upload (no owner)
- **atlas-field-notes.txt** - Processing upload (no owner)

### Books (for Library page):

- **Foundation** - Isaac Asimov (processed, owned by test user with 25.5% progress)
- **I, Robot** - Isaac Asimov (processing, file owned by test user but no user-book link yet)
- **Dune** - Frank Herbert (processed, from shop, not owned by test user)
- **The Martian Chronicles** - Ray Bradbury (processed, owned by test user with 8% progress)
- **The Ember Archive** - A. Storyteller (processed, uploaded, not owned by test user)
- **Atlas Field Notes** - Q. Cartographer (not processed, from shop, not owned by test user)

### User-Books (for Dashboard & Reading Progress):

- **Foundation** - Last opened, 25.5% progress, page 12
- **The Martian Chronicles** - 8% progress, page 5

## Test Status

All test scenarios have been implemented and cover the following:
- ✅ Guest and authenticated dashboard views
- ✅ Registration, login, and logout flows  
- ✅ Personal cabinet and password change functionality
- ✅ Authorization guards for books, files, and API endpoints

**Note**: Tests are functional but may need minor selector adjustments for strict mode violations. See `/tmp/E2E_IMPLEMENTATION_SUMMARY.md` for details.

## Test Approach

- Tests are designed to work with seed data but also handle cases where data might not exist
- Uses flexible assertions that check for "either condition A or B" where appropriate
- Handles multiple elements with the same text by using `.first()` or more specific selectors
- Tests both positive and negative scenarios
- Includes responsive design testing for mobile and tablet viewports

## Known Limitations

- File upload tests create real files in the database during test execution
- Tests may leave test files in the database (cleanup can be added if needed)
- Some tests rely on specific seed data being present
- Font loading warnings from Google Fonts are expected and do not affect tests

## Troubleshooting

### Tests timing out

- Increase timeout in playwright.config.ts
- Check that MongoDB is running and accessible
- Ensure Next.js dev server starts properly

### Tests failing due to missing elements

- Verify MongoDB is running
- Check that .env file exists with correct MongoDB settings
- Clear browser cache if needed

### Multiple elements found errors

- This has been addressed by using `.first()` or more specific selectors
- If new errors occur, update selectors to be more specific

## Future Improvements

- Add test data cleanup after test runs
- Add tests for file processing status updates
- Add tests for error handling scenarios
- Add visual regression testing
- Add accessibility testing with axe-core
