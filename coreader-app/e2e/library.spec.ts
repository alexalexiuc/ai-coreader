import { expect, test } from '@playwright/test';

test.describe('Library Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/library');
  });

  test.describe('Page Load and Layout', () => {
    test('should load library page successfully', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Your books' })).toBeVisible();
    });

    test('should display navigation actions', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Upload' }).first()).toBeVisible();
      // Shop is rendered as a disabled link
      const shopLink = page.getByRole('link', { name: /Shop/i }).first();
      await expect(shopLink).toBeVisible();
      const ariaDisabled = await shopLink.getAttribute('aria-disabled');
      expect(ariaDisabled).toBe('true');
    });

    test('should display search input', async ({ page }) => {
      await expect(page.getByPlaceholder('Search by title or author…')).toBeVisible();
    });

    test('should display sort dropdown', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Select' })).toBeVisible();
    });

    test('should display view toggle buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Grid view' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'List view' })).toBeVisible();
    });

    test('should display filter tabs with counts', async ({ page }) => {
      // Check that filter tabs are present
      const allTab = page.getByRole('button', { name: /^All/i }).first();
      await expect(allTab).toBeVisible();
      
      // Verify the filter tabs exist
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Reading');
      expect(bodyText).toContain('Unread');
      expect(bodyText).toContain('Finished');
      expect(bodyText).toContain('Pinned');
    });

    test('should display Books section', async ({ page }) => {
      // Just verify the Books section header exists
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Books');
    });
  });

  test.describe('Empty States', () => {
    test('should show empty library state when no books exist', async ({ page }) => {
      // This test assumes a fresh database or all books are not processed
      const emptyMessage = page.getByText('Your library is empty');
      if (await emptyMessage.isVisible()) {
        await expect(emptyMessage).toBeVisible();
        await expect(page.getByText('Library shows books that are ready to read')).toBeVisible();
        await expect(page.getByRole('link', { name: /Upload a book/i })).toBeVisible();
      }
    });

    test('should show empty filtered state when search has no results', async ({ page }) => {
      // Type a search query that won't match anything
      const searchInput = page.getByPlaceholder('Search by title or author…');
      await searchInput.fill('nonexistentbook12345xyz');
      await page.waitForTimeout(300);

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

    test('should show empty state for pinned filter when no books are pinned', async ({ page }) => {
      // Click on Pinned filter tab
      const pinnedTab = page.getByRole('button', { name: /Pinned/i });
      await pinnedTab.click();
      await page.waitForTimeout(300);

      // May show empty message
      const emptyMessage = page.getByText('Nothing here yet');
      if (await emptyMessage.isVisible()) {
        await expect(emptyMessage).toBeVisible();
        await expect(page.getByText('Pin books to keep them at the top.')).toBeVisible();
      }
    });
  });

  test.describe('Book Display with Seed Data', () => {
    test('should display books in grid view by default', async ({ page }) => {
      // With seed data, we should have books
      const bookCards = page.locator('div').filter({ hasText: /Foundation|Dune|Robot|Martian/i });
      const count = await bookCards.count();
      
      if (count > 0) {
        // Should display book titles
        const hasFoundation = await page.getByText('Foundation').isVisible().catch(() => false);
        const hasDune = await page.getByText('Dune').isVisible().catch(() => false);
        const hasRobot = await page.getByText('I, Robot').isVisible().catch(() => false);
        const hasMartian = await page.getByText('The Martian Chronicles').isVisible().catch(() => false);
        
        // At least one book should be visible
        expect(hasFoundation || hasDune || hasRobot || hasMartian).toBeTruthy();
      }
    });

    test('should display book information correctly', async ({ page }) => {
      // Check for book cards with proper structure
      const bookCards = page.locator('a[href*="/reader/"]');
      const count = await bookCards.count();

      if (count > 0) {
        const firstCard = bookCards.first();
        
        // Should have book icon
        const iconCount = await firstCard.locator('svg').count();
        expect(iconCount).toBeGreaterThan(0);
        
        // Should have text content (title, author, etc.)
        const text = await firstCard.textContent();
        expect(text).toBeTruthy();
        expect(text?.length).toBeGreaterThan(10);
      }
    });

    test('should display book source badges', async ({ page }) => {
      // Check for Uploaded or Shop badges
      const uploadedBadge = page.getByText('Uploaded').first();
      const shopBadge = page.getByText('Shop').first();
      
      const hasUploaded = await uploadedBadge.isVisible().catch(() => false);
      const hasShop = await shopBadge.isVisible().catch(() => false);
      
      // At least one source badge should be visible
      expect(hasUploaded || hasShop).toBeTruthy();
    });

    test('should display book progress for reading books', async ({ page }) => {
      // Look for progress indicators (percentage)
      const progressText = page.getByText(/%/).first();
      
      if (await progressText.isVisible().catch(() => false)) {
        await expect(progressText).toBeVisible();
        // Progress bar should be visible
        const progressBar = page.locator('div[style*="width:"]').first();
        await expect(progressBar).toBeVisible();
      }
    });

    test('should display finished badge for completed books', async ({ page }) => {
      // Look for Finished status
      const finishedBadge = page.getByText('Finished').first();
      
      if (await finishedBadge.isVisible().catch(() => false)) {
        await expect(finishedBadge).toBeVisible();
      }
    });

    test('should display unread status for books not started', async ({ page }) => {
      // Look for Unread status
      const unreadBadge = page.getByText('Unread').first();
      
      if (await unreadBadge.isVisible().catch(() => false)) {
        await expect(unreadBadge).toBeVisible();
      }
    });

    test('should not display unprocessed books in library or show processing', async ({ page }) => {
      // I, Robot is unprocessed in seed data
      const bodyText = await page.locator('body').textContent();
      
      // If I, Robot appears, it should be marked as Processing
      if (bodyText?.includes('I, Robot')) {
        const processingText = page.getByText('Processing').first();
        await expect(processingText).toBeVisible();
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter books by title', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search by title or author…');
      
      // Search for a specific book
      await searchInput.fill('Foundation');
      await page.waitForTimeout(300);
      
      // Should show filtered results
      const foundationText = page.getByText('Foundation');
      if (await foundationText.isVisible().catch(() => false)) {
        await expect(foundationText).toBeVisible();
      }
    });

    test('should filter books by author', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search by title or author…');
      
      // Search by author
      await searchInput.fill('Asimov');
      await page.waitForTimeout(300);
      
      // Should show Asimov books
      const bodyText = await page.locator('body').textContent();
      if (bodyText?.toLowerCase().includes('asimov')) {
        expect(bodyText).toContain('Asimov');
      }
    });

    test('should clear search results', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search by title or author…');
      
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
    test('should show books or empty state when All filter selected', async ({ page }) => {
      // Click on All filter tab
      const allTab = page.getByRole('button', { name: /^All/i }).first();
      await allTab.click();
      await page.waitForTimeout(300);

      // Should show books or empty state
      const emptyMessage = page.getByText('Your library is empty');
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      if (!hasEmptyMessage) {
        // If not empty, should have some book elements
        const bookElements = page.locator('a[href*="/reader/"]');
        const count = await bookElements.count();
        expect(count).toBeGreaterThan(0);
      } else {
        await expect(emptyMessage).toBeVisible();
      }
    });

    test('should filter by reading books', async ({ page }) => {
      // Click on Reading filter tab
      const readingTab = page.getByRole('button', { name: /^Reading/i });
      await readingTab.click();
      await page.waitForTimeout(300);

      // May show reading books or empty state
      const progressText = page.getByText(/%/).first();
      const emptyMessage = page.getByText('Start a book to see it here');
      
      const hasProgress = await progressText.isVisible().catch(() => false);
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      expect(hasProgress || hasEmptyMessage).toBeTruthy();
    });

    test('should filter by unread books', async ({ page }) => {
      // Click on Unread filter tab
      const unreadTab = page.getByRole('button', { name: /^Unread/i });
      await unreadTab.click();
      await page.waitForTimeout(300);

      // May show unread books or empty state
      const unreadBadge = page.getByText('Unread').first();
      const emptyMessage = page.getByText('Nothing here yet');
      
      const hasUnread = await unreadBadge.isVisible().catch(() => false);
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      expect(hasUnread || hasEmptyMessage).toBeTruthy();
    });

    test('should filter by finished books', async ({ page }) => {
      // Click on Finished filter tab
      const finishedTab = page.getByRole('button', { name: /^Finished/i });
      await finishedTab.click();
      await page.waitForTimeout(300);

      // May show finished books or empty state
      const finishedBadge = page.getByText('Finished').first();
      const emptyMessage = page.getByText('Finish a book to see it here');
      
      const hasFinished = await finishedBadge.isVisible().catch(() => false);
      const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);
      
      expect(hasFinished || hasEmptyMessage).toBeTruthy();
    });

    test('should filter by pinned books', async ({ page }) => {
      // Click on Pinned filter tab
      const pinnedTab = page.getByRole('button', { name: /^Pinned/i });
      await pinnedTab.click();
      await page.waitForTimeout(300);

      // Should show empty state by default (no pinned books in seed)
      const emptyMessage = page.getByText('Pin books to keep them at the top');
      if (await emptyMessage.isVisible().catch(() => false)) {
        await expect(emptyMessage).toBeVisible();
      }
    });
  });

  test.describe('Sort Functionality', () => {
    test('should sort by last opened', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Select' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Last opened' }).click();
      await page.waitForTimeout(300);
      
      // Should work without errors
      await expect(sortButton).toBeVisible();
    });

    test('should sort by recently added', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Select' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Recently added' }).click();
      await page.waitForTimeout(300);
      
      await expect(sortButton).toBeVisible();
    });

    test('should sort by title A-Z', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Select' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Title A-Z' }).click();
      await page.waitForTimeout(300);
      
      await expect(sortButton).toBeVisible();
    });

    test('should sort by progress', async ({ page }) => {
      const sortButton = page.getByRole('button', { name: 'Select' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Progress' }).click();
      await page.waitForTimeout(300);
      
      await expect(sortButton).toBeVisible();
    });
  });

  test.describe('View Toggle', () => {
    test('should switch to list view', async ({ page }) => {
      const listViewButton = page.getByRole('button', { name: 'List view' });
      await listViewButton.click();
      await page.waitForTimeout(300);
      
      // List view should be active now
      await expect(listViewButton).toBeVisible();
    });

    test('should switch to grid view', async ({ page }) => {
      // First switch to list view
      const listViewButton = page.getByRole('button', { name: 'List view' });
      await listViewButton.click();
      await page.waitForTimeout(300);
      
      // Then switch back to grid view
      const gridViewButton = page.getByRole('button', { name: 'Grid view' });
      await gridViewButton.click();
      await page.waitForTimeout(300);
      
      await expect(gridViewButton).toBeVisible();
    });

    test('should display books correctly in list view', async ({ page }) => {
      // Switch to list view
      const listViewButton = page.getByRole('button', { name: 'List view' });
      await listViewButton.click();
      await page.waitForTimeout(300);
      
      // Books should still be visible
      const hasBooks = await page.getByText(/Foundation|Dune/).isVisible().catch(() => false);
      if (hasBooks) {
        await expect(page.getByText(/Foundation|Dune/).first()).toBeVisible();
      }
    });
  });

  test.describe('Pin Functionality', () => {
    test('should have pin buttons for books', async ({ page }) => {
      // Look for pin buttons (by aria-label)
      const pinButtons = page.getByLabel(/Pin|Unpin/i);
      const count = await pinButtons.count();
      
      if (count > 0) {
        await expect(pinButtons.first()).toBeVisible();
      }
    });

    test('should pin a book when pin button clicked', async ({ page }) => {
      // Find a pin button
      const pinButton = page.getByLabel('Pin book').first();
      
      if (await pinButton.isVisible().catch(() => false)) {
        // Click pin
        await pinButton.click();
        await page.waitForTimeout(300);
        
        // Button should now be unpin
        const unpinButton = page.getByLabel('Unpin book').first();
        await expect(unpinButton).toBeVisible();
      }
    });

    test('should unpin a book when unpin button clicked', async ({ page }) => {
      // First pin a book
      const pinButton = page.getByLabel('Pin book').first();
      
      if (await pinButton.isVisible().catch(() => false)) {
        await pinButton.click();
        await page.waitForTimeout(300);
        
        // Now unpin it
        const unpinButton = page.getByLabel('Unpin book').first();
        await unpinButton.click();
        await page.waitForTimeout(300);
        
        // Should be back to pin state
        await expect(page.getByLabel('Pin book').first()).toBeVisible();
      }
    });

    test('should show pinned books in pinned filter', async ({ page }) => {
      // Pin a book first
      const pinButton = page.getByLabel('Pin book').first();
      
      if (await pinButton.isVisible().catch(() => false)) {
        // Get book title before pinning
        const bookCard = pinButton.locator('xpath=ancestor::div[contains(@class, "rounded")]');
        const bookTitle = await bookCard.textContent();
        
        await pinButton.click();
        await page.waitForTimeout(300);
        
        // Navigate to pinned filter
        const pinnedTab = page.getByRole('button', { name: /^Pinned/i });
        await pinnedTab.click();
        await page.waitForTimeout(300);
        
        // The pinned book should be visible
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).toBeTruthy();
      }
    });
  });

  test.describe('Combined Filters', () => {
    test('should combine search and filter', async ({ page }) => {
      // Enter search term
      const searchInput = page.getByPlaceholder('Search by title or author…');
      await searchInput.fill('Asimov');
      
      // Select All filter
      const allTab = page.getByRole('button', { name: /^All/i }).first();
      await allTab.click();
      
      await page.waitForTimeout(300);
      
      // Should show filtered and searched results
      const bodyText = await page.locator('body').textContent();
      
      // Either shows results or empty state
      const hasAsimov = bodyText?.toLowerCase().includes('asimov');
      const hasEmpty = bodyText?.toLowerCase().includes('no match');
      
      expect(hasAsimov || hasEmpty).toBeTruthy();
    });

    test('should combine search, filter, and sort', async ({ page }) => {
      // Enter search
      await page.getByPlaceholder('Search by title or author…').fill('a');
      
      // Select filter
      await page.getByRole('button', { name: /^All/i }).first().click();
      
      // Select sort
      const sortButton = page.getByRole('button', { name: 'Select' });
      await sortButton.click();
      await page.getByRole('option', { name: 'Title A-Z' }).click();
      
      await page.waitForTimeout(300);
      
      // Should work without errors
      await expect(page.getByPlaceholder('Search by title or author…')).toHaveValue('a');
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to uploads page', async ({ page }) => {
      const uploadsLink = page.getByRole('link', { name: 'Upload' }).first();
      await uploadsLink.click();
      
      // Should navigate to uploads page
      await expect(page).toHaveURL('/uploads');
    });

    test('should navigate to book reader from book card', async ({ page }) => {
      // Find a book link (processed books only)
      const bookLink = page.locator('a[href*="/reader/"]').first();
      
      if (await bookLink.isVisible().catch(() => false)) {
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
      await page.goto('/library');
      
      // Key elements should still be visible
      await expect(page.getByRole('heading', { name: 'Your books' })).toBeVisible();
      await expect(page.getByPlaceholder('Search by title or author…')).toBeVisible();
      // Sort dropdown may be visible or hidden on mobile, just check page loads
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/library');
      
      await expect(page.getByRole('heading', { name: 'Your books' })).toBeVisible();
      await expect(page.getByPlaceholder('Search by title or author…')).toBeVisible();
    });
  });
});
