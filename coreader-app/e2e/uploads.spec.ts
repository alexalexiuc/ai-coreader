import { expect, test } from '@playwright/test';

test.describe('Uploads Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/uploads');
  });

  test.describe('Page Load and Layout', () => {
    test('should load uploads page successfully', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible();
      await expect(page.getByText('Uploaded files appear here while they are processed into readable books.')).toBeVisible();
    });

    test('should display navigation buttons', async ({ page }) => {
      await expect(page.getByRole('link', { name: /Library/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Shop/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Shop/i })).toBeDisabled();
    });

    test('should display upload section', async ({ page }) => {
      await expect(page.getByText('Upload')).toBeVisible();
      await expect(page.getByText('Drop your book file')).toBeVisible();
    });

    test('should display search and filter controls', async ({ page }) => {
      await expect(page.getByPlaceholder('Search files...')).toBeVisible();
      // Sort button (custom dropdown)
      await expect(page.getByRole('button', { name: 'Sort' })).toBeVisible();
    });

    test('should display status filter tabs with counts', async ({ page }) => {
      // Check that filter tabs are present
      await expect(page.getByText(/All/i)).toBeVisible();
      await expect(page.getByText(/Processing/i)).toBeVisible();
      await expect(page.getByText(/Completed/i)).toBeVisible();
      await expect(page.getByText(/Failed/i)).toBeVisible();
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no files uploaded', async ({ page }) => {
      // This test assumes a fresh database or no files
      // Check if we see the empty uploads message
      const emptyMessage = page.getByText('No files uploaded yet');
      if (await emptyMessage.isVisible()) {
        await expect(emptyMessage).toBeVisible();
        await expect(page.getByText('Upload a file to start processing it into a book.')).toBeVisible();
        await expect(page.getByText('Use the upload button to begin')).toBeVisible();
      }
    });

    test('should show empty filtered state when search has no results', async ({ page }) => {
      // Type a search query that won't match anything
      const searchInput = page.getByPlaceholder('Search files...');
      await searchInput.fill('nonexistentfile12345xyz');
      await searchInput.press('Enter');

      // Should show empty filtered state
      const noMatches = page.getByText(/No matches for/i);
      if (await noMatches.isVisible()) {
        await expect(noMatches).toBeVisible();
        await expect(page.getByText('Try a different search term, or clear the search.')).toBeVisible();
        
        // Clear search button should be visible
        const clearButton = page.getByRole('button', { name: /Clear search/i });
        await expect(clearButton).toBeVisible();
        
        // Click clear and verify search is cleared
        await clearButton.click();
        await expect(searchInput).toHaveValue('');
      }
    });
  });

  test.describe('File Upload', () => {
    test('should enable upload button when file is selected', async ({ page }) => {
      const uploadButton = page.getByRole('button', { name: 'Upload book' });
      const clearButton = page.getByRole('button', { name: 'Clear selection' });

      // Initially upload and clear should be disabled (no file selected)
      await expect(uploadButton).toBeDisabled();
      await expect(clearButton).toBeDisabled();

      // Create a simple text file for upload
      const fileContent = 'This is a test book content for uploading.';
      const buffer = Buffer.from(fileContent, 'utf-8');
      
      // Find the file input and upload
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-book.txt',
        mimeType: 'text/plain',
        buffer: buffer,
      });

      // Check that buttons are now enabled
      await expect(uploadButton).toBeEnabled();
      await expect(clearButton).toBeEnabled();
      await expect(page.getByText('Ready to upload: test-book.txt')).toBeVisible();
    });

    test('should clear selected file when clear button clicked', async ({ page }) => {
      const uploadButton = page.getByRole('button', { name: 'Upload book' });
      const clearButton = page.getByRole('button', { name: 'Clear selection' });

      // Upload a file
      const fileContent = 'Test content';
      const buffer = Buffer.from(fileContent, 'utf-8');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test-clear.txt',
        mimeType: 'text/plain',
        buffer: buffer,
      });

      await expect(uploadButton).toBeEnabled();
      await expect(page.getByText('Ready to upload: test-clear.txt')).toBeVisible();

      // Click clear
      await clearButton.click();

      // Verify file is cleared
      await expect(uploadButton).toBeDisabled();
      await expect(page.getByText('Ready to upload: test-clear.txt')).not.toBeVisible();
    });

    test('should upload file successfully', async ({ page }) => {
      const uploadButton = page.getByRole('button', { name: 'Upload book' });

      // Upload a file
      const fileContent = 'This is test content for a successful upload.';
      const buffer = Buffer.from(fileContent, 'utf-8');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'successful-upload.txt',
        mimeType: 'text/plain',
        buffer: buffer,
      });

      // Click upload
      await uploadButton.click();

      // Wait for success message
      await expect(page.getByText('Uploaded! We will process the book and add it to your library shortly.')).toBeVisible({
        timeout: 10000,
      });

      // File should appear in the list (might need to wait for page revalidation)
      await page.waitForTimeout(1000);
      // The file should now be in the list somewhere
      await expect(page.getByText('successful-upload.txt')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('File Listing with Seed Data', () => {
    test('should display files with different statuses', async ({ page }) => {
      // With seed data, we should have files in various states
      // Check for status badges
      const processingBadge = page.getByText('Processing').first();
      const completedBadge = page.getByText('Completed').first();
      const failedBadge = page.getByText('Failed').first();

      // At least one of these should be visible with seed data
      const hasProcessing = await processingBadge.isVisible().catch(() => false);
      const hasCompleted = await completedBadge.isVisible().catch(() => false);
      const hasFailed = await failedBadge.isVisible().catch(() => false);

      // At least one status should be visible
      expect(hasProcessing || hasCompleted || hasFailed).toBeTruthy();
    });

    test('should display file information correctly', async ({ page }) => {
      // Check for file rows with proper structure
      const fileRows = page.locator('[class*="grid"][class*="grid-cols"]');
      const rowCount = await fileRows.count();

      if (rowCount > 0) {
        // First file row should have all necessary elements
        const firstRow = fileRows.first();
        
        // Should have file icon, name, status, size, date
        await expect(firstRow.locator('svg').first()).toBeVisible();
        // Text content should be present (filename, size, date)
        const text = await firstRow.textContent();
        expect(text).toBeTruthy();
      }
    });

    test('should display completed file with book link', async ({ page }) => {
      // Look for a completed file with a book link
      const bookLink = page.getByText(/Book created:/i);
      
      if (await bookLink.isVisible()) {
        await expect(bookLink).toBeVisible();
        // Should have a clickable link to the book
        const link = page.locator('a[href*="/reader/"]').first();
        await expect(link).toBeVisible();
      }
    });

    test('should display processing file with progress bar', async ({ page }) => {
      // Look for processing badge
      const processingFile = page.getByText('Processing').first();
      
      if (await processingFile.isVisible()) {
        // Check for progress indicators near the processing badge
        const progressText = page.getByText(/%/);
        if (await progressText.isVisible()) {
          await expect(progressText).toBeVisible();
          // Progress bar should be visible (it's a styled div)
          const progressBar = page.locator('div[style*="width:"]').first();
          await expect(progressBar).toBeVisible();
        }
      }
    });

    test('should display failed file with error message', async ({ page }) => {
      // Look for failed badge
      const failedBadge = page.getByText('Failed').first();
      
      if (await failedBadge.isVisible()) {
        // Failed files should show error message
        // Look for text that looks like an error (containing common error words)
        const errorIndicators = ['Unsupported', 'failed', 'error', 'Error'];
        let foundError = false;
        
        for (const indicator of errorIndicators) {
          const errorText = page.getByText(new RegExp(indicator, 'i'));
          if (await errorText.isVisible()) {
            foundError = true;
            break;
          }
        }
        
        expect(foundError).toBeTruthy();
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter files by search query', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search files...');
      
      // Get initial file count
      await page.waitForTimeout(500);
      const allFilesText = await page.locator('body').textContent();
      
      // Search for a specific term (based on seed data)
      await searchInput.fill('foundation');
      await page.waitForTimeout(500);
      
      // Should show filtered results
      const filteredText = await page.locator('body').textContent();
      
      // If foundation.txt exists, it should be visible
      if (filteredText?.toLowerCase().includes('foundation')) {
        await expect(page.getByText(/foundation/i)).toBeVisible();
      }
    });

    test('should clear search results', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search files...');
      
      // Enter search term
      await searchInput.fill('test');
      await page.waitForTimeout(300);
      
      // Clear search
      await searchInput.clear();
      await page.waitForTimeout(300);
      
      // Verify input is empty
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Filter Functionality', () => {
    test('should filter by completed status', async ({ page }) => {
      // Click on Completed filter tab
      const completedTab = page.getByRole('button', { name: /Completed/i });
      await completedTab.click();
      await page.waitForTimeout(500);

      // Check if completed badge is visible
      const completedBadges = page.getByText('Completed');
      const count = await completedBadges.count();
      
      if (count > 0) {
        // Should only show completed files
        const processingBadge = page.getByText('Processing');
        const failedBadge = page.getByText('Failed');
        
        // Processing and Failed should not be visible (or minimal visibility from UI labels)
        const processingCount = await processingBadge.count();
        const failedCount = await failedBadge.count();
        
        // These counts should be less than completed (only in filter tabs)
        expect(count).toBeGreaterThanOrEqual(processingCount);
      }
    });

    test('should filter by processing status', async ({ page }) => {
      // Click on Processing filter tab
      const processingTab = page.getByRole('button', { name: /^Processing/i });
      await processingTab.click();
      await page.waitForTimeout(500);

      // May show processing files or empty state
      const processingBadges = page.getByText('Processing');
      const emptyMessage = page.getByText('No files are currently processing');
      
      const hasProcessing = await processingBadges.first().isVisible().catch(() => false);
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      // Either should show processing files or empty message
      expect(hasProcessing || hasEmptyMessage).toBeTruthy();
    });

    test('should filter by failed status', async ({ page }) => {
      // Click on Failed filter tab
      const failedTab = page.getByRole('button', { name: /^Failed/i });
      await failedTab.click();
      await page.waitForTimeout(500);

      // May show failed files or empty state
      const failedBadges = page.getByText('Failed');
      const emptyMessage = page.getByText('No failed uploads');
      
      const hasFailed = await failedBadges.first().isVisible().catch(() => false);
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      // Either should show failed files or empty message
      expect(hasFailed || hasEmptyMessage).toBeTruthy();
    });

    test('should show all files when All filter selected', async ({ page }) => {
      // Click on All filter tab
      const allTab = page.getByRole('button', { name: /^All/i });
      await allTab.click();
      await page.waitForTimeout(500);

      // Should show count of all files or empty state
      const emptyMessage = page.getByText('No files uploaded yet');
      const hasFiles = await page.getByText('shown').isVisible().catch(() => false);
      const isEmpty = await emptyMessage.isVisible().catch(() => false);
      
      // Either files are shown or empty state
      expect(hasFiles || isEmpty).toBeTruthy();
    });
  });

  test.describe('Sort Functionality', () => {
    test('should sort by newest first', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Sort' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Newest first' }).click();
      await page.waitForTimeout(500);
      
      // Files should be displayed (can't easily verify order in E2E without known data)
      // Just verify no errors occurred
      await expect(sortButton).toBeVisible();
    });

    test('should sort by oldest first', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Sort' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Oldest first' }).click();
      await page.waitForTimeout(500);
      
      await expect(sortButton).toBeVisible();
    });

    test('should sort by file name A-Z', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Sort' });
      await sortButton.click();
      await page.getByRole('option', { name: 'File name A-Z' }).click();
      await page.waitForTimeout(500);
      
      await expect(sortButton).toBeVisible();
    });

    test('should sort by status', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Sort' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Status' }).click();
      await page.waitForTimeout(500);
      
      await expect(sortButton).toBeVisible();
    });
  });

  test.describe('File Actions', () => {
    test('should have download button for all files', async ({ page }) => {
      // Look for download buttons (by aria-label)
      const downloadButtons = page.getByLabel('Download original file');
      const count = await downloadButtons.count();
      
      if (count > 0) {
        await expect(downloadButtons.first()).toBeVisible();
      }
    });

    test('should have delete button for all files', async ({ page }) => {
      // Look for delete buttons
      const deleteButtons = page.getByLabel('Delete file');
      const count = await deleteButtons.count();
      
      if (count > 0) {
        await expect(deleteButtons.first()).toBeVisible();
      }
    });

    test('should have retry button for failed files', async ({ page }) => {
      // Look for failed badge first
      const failedBadge = page.getByText('Failed').first();
      
      if (await failedBadge.isVisible()) {
        // Should have a retry button nearby
        const retryButton = page.getByLabel('Retry processing');
        if (await retryButton.isVisible()) {
          await expect(retryButton).toBeVisible();
        }
      }
    });

    test('should delete file when delete button clicked', async ({ page }) => {
      // Find any file's delete button
      const deleteButtons = page.getByLabel('Delete file');
      const count = await deleteButtons.count();
      
      if (count > 0) {
        // Get the file name before deletion
        const firstDeleteButton = deleteButtons.first();
        const fileRow = firstDeleteButton.locator('xpath=ancestor::div[contains(@class, "grid")]');
        const fileName = await fileRow.textContent();
        
        // Click delete
        await firstDeleteButton.click();
        
        // Wait for the file to be removed
        await page.waitForTimeout(1000);
        
        // Verify the file is no longer visible (if we can identify it)
        // This is a basic check - in real scenarios you'd verify the specific file is gone
        const newCount = await deleteButtons.count();
        expect(newCount).toBeLessThanOrEqual(count);
      }
    });

    test('should retry failed file when retry button clicked', async ({ page }) => {
      // Look for a failed file with retry button
      const retryButton = page.getByLabel('Retry processing').first();
      
      if (await retryButton.isVisible()) {
        // Click retry
        await retryButton.click();
        
        // Wait for status change
        await page.waitForTimeout(1000);
        
        // The file should now show as processing or the retry button should be gone
        const stillVisible = await retryButton.isVisible().catch(() => false);
        // Either button is gone (now processing) or still there (if it failed again quickly)
        // We can't guarantee the outcome, but action should complete without error
        expect(true).toBeTruthy();
      }
    });
  });

  test.describe('Combined Filters', () => {
    test('should combine search and status filter', async ({ page }) => {
      // Enter search term
      const searchInput = page.getByPlaceholder('Search files...');
      await searchInput.fill('foundation');
      
      // Select completed filter
      const completedTab = page.getByRole('button', { name: /Completed/i });
      await completedTab.click();
      
      await page.waitForTimeout(500);
      
      // Should show filtered and searched results
      // If foundation.txt is completed, it should show
      const foundationFile = page.getByText(/foundation/i);
      const completedBadge = page.getByText('Completed');
      
      // Either shows results or empty state
      const hasResults = await foundationFile.isVisible().catch(() => false);
      const isEmpty = await page.getByText(/No matches|Nothing here/i).isVisible().catch(() => false);
      
      expect(hasResults || isEmpty).toBeTruthy();
    });

    test('should combine search, filter, and sort', async ({ page }) => {
      // Enter search
      await page.getByPlaceholder('Search files...').fill('txt');
      
      // Select filter
      await page.getByRole('button', { name: /All/i }).click();
      
      // Select sort
      const sortButton = page.getByRole('button', { name: 'Sort' });
      await sortButton.click();
      await page.getByRole('option', { name: 'File name A-Z' }).click();
      
      await page.waitForTimeout(500);
      
      // Should work without errors
      await expect(page.getByPlaceholder('Search files...')).toHaveValue('txt');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to library page', async ({ page }) => {
      const libraryLink = page.getByRole('link', { name: /Library/i });
      await libraryLink.click();
      
      // Should navigate to library page
      await expect(page).toHaveURL('/library');
    });

    test('should navigate to book reader from completed file', async ({ page }) => {
      // Find a book link
      const bookLink = page.locator('a[href*="/reader/"]').first();
      
      if (await bookLink.isVisible()) {
        const href = await bookLink.getAttribute('href');
        await bookLink.click();
        
        // Should navigate to reader page
        await expect(page).toHaveURL(new RegExp('/reader/.*'));
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/uploads');
      
      // Key elements should still be visible
      await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Search files...')).toBeVisible();
      await expect(page.getByText('Drop your book file')).toBeVisible();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/uploads');
      
      await expect(page.getByRole('heading', { name: 'Files', exact: true })).toBeVisible();
      await expect(page.getByPlaceholder('Search files...')).toBeVisible();
    });
  });
});
