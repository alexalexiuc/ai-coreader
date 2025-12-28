# E2E Testing

This directory contains end-to-end tests for the application.

## Test Files

- **home.spec.ts** - Basic test for home page
- **uploads.spec.ts** - Comprehensive E2E test suite with 36 tests covering all uploads page functionality
- **library.spec.ts** - Comprehensive E2E test suite with 42 tests covering all library page functionality

## Library Page Test Coverage

### 1. Page Load and Layout (7 tests)

- Page loads with correct heading
- Navigation actions (Upload link, Shop disabled button)
- Search input visibility
- Sort dropdown visibility
- View toggle buttons (Grid/List)
- Filter tabs with counts
- Books section

### 2. Empty States (3 tests)

- Empty library state message
- Empty filtered results with clear search button
- Empty state for pinned filter

### 3. Book Display with Seed Data (6 tests)

- Display books in grid view by default
- Book information display (title, author, etc.)
- Book source badges (Uploaded/Shop)
- Book progress for reading books
- Finished badge for completed books
- Unread status for books not started

### 4. Search Functionality (3 tests)

- Filter books by title
- Filter books by author
- Clear search results

### 5. Filter by Status (5 tests)

- Filter by All books
- Filter by Reading only
- Filter by Unread only
- Filter by Finished only
- Filter by Pinned only

### 6. Sort Options (4 tests)

- Sort by last opened
- Sort by recently added
- Sort by title A-Z
- Sort by progress

### 7. View Toggle (3 tests)

- Switch to list view
- Switch to grid view
- Display books correctly in list view

### 8. Pin Functionality (4 tests)

- Pin buttons availability
- Pin a book
- Unpin a book
- Show pinned books in pinned filter

### 9. Combined Filters (2 tests)

- Combine search and filter
- Combine search, filter, and sort

### 10. Navigation (2 tests)

- Navigate to uploads page
- Navigate to book reader from book card

### 11. Responsive Design (2 tests)

- Mobile viewport (375x667)
- Tablet viewport (768x1024)

## Uploads Page Test Coverage

### 1. Page Load and Layout (5 tests)

- Page loads with correct heading and description
- Navigation buttons (Library link, Shop disabled button)
- Upload section visibility
- Search and filter controls
- Status filter tabs with counts

### 2. Empty States (2 tests)

- No uploads empty state message
- Empty filtered results with clear search button

### 3. File Upload (3 tests)

- Upload button enable/disable based on file selection
- Clear selection button functionality
- Successful file upload flow

### 4. File Listing with Seed Data (5 tests)

- Display files with different statuses (processing, completed, failed)
- File information display (name, size, upload date)
- Completed files show book links
- Processing files show progress bars
- Failed files show error messages

### 5. Search Functionality (2 tests)

- Filter files by search query
- Clear search results

### 6. Filter by Status (4 tests)

- Filter by All statuses
- Filter by Processing only
- Filter by Completed only
- Filter by Failed only

### 7. Sort Options (4 tests)

- Sort by newest first
- Sort by oldest first
- Sort by file name A-Z
- Sort by status

### 8. File Actions (6 tests)

- Download button availability
- Delete button availability
- Retry button for failed files
- Delete file operation
- Retry failed file operation

### 9. Combined Filters (2 tests)

- Combine search with status filter
- Combine search, filter, and sort

### 10. Navigation (2 tests)

- Navigate to library page
- Navigate to book reader from completed file

### 11. Responsive Design (2 tests)

- Mobile viewport (375x667)
- Tablet viewport (768x1024)

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

### Run Only Uploads Tests

```bash
npm run e2e -- uploads.spec.ts
```

### Run Only Library Tests

```bash
npm run e2e -- library.spec.ts
```

### Run Tests in UI Mode

```bash
npm run e2e:ui
```

## Test Data

Tests automatically apply seed data from `/infra/db/seeds/20250201000000-sample-data.js`, which includes:

### Files (for Uploads page):
- **foundation.txt** - Completed upload with book
- **i_robot.txt** - Processing upload (45% complete)
- **dune.txt** - Completed upload
- **bradbury_martian_chronicles.txt** - Completed upload
- **some_scan.pdf** - Failed upload (unsupported format)

### Books (for Library page):
- **Foundation** - Isaac Asimov (processed, uploaded)
- **I, Robot** - Isaac Asimov (not processed, uploaded)
- **Dune** - Frank Herbert (processed, from shop)
- **The Martian Chronicles** - Ray Bradbury (processed, from shop)
- **The Ember Archive** - A. Storyteller (processed, uploaded)
- **Atlas Field Notes** - Q. Cartographer (not processed, from shop)

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
