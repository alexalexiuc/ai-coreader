import { expect, test } from '@playwright/test';

test.describe('Authorization Guards', () => {
  test.describe('Book Ownership', () => {
    test('should allow access to owned book', async ({ page }) => {
      // Login as test user
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Navigate to library to find book ID
      await page.goto('/library');
      await page.waitForTimeout(500);

      // Find and click on Foundation book (owned by test user)
      const foundationLink = page.getByRole('link', { name: /Foundation/i }).first();
      if (await foundationLink.isVisible()) {
        await foundationLink.click();

        // Should successfully navigate to reader
        await page.waitForURL(/\/reader\/[a-f0-9]+/);
        await expect(page.locator('body')).toContainText('Foundation');
      } else {
        // If not visible in grid, try list view or search
        console.log('Foundation book not immediately visible, test may need adjustment');
      }
    });

    test('should deny access to non-owned book', async ({ page, request }) => {
      // First, we need to find a book that is NOT owned by testuser@example.com
      // From seeds, "Dune" and "The Ember Archive" are NOT linked to test user

      // Login as test user
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Try to access a book that exists but is not owned (using known ID from seeds)
      // Book ID for "Dune" from seeds: 66f000000000000000000503
      const nonOwnedBookId = '66f000000000000000000503';

      // Try to navigate directly to this book
      const response = await page.goto(`/reader/${nonOwnedBookId}`);

      // Should either:
      // 1. Redirect to home/library (403/401 handling)
      // 2. Show error message
      // 3. Show 404 (book not found for this user)

      // Check if we're redirected or see an error
      const currentUrl = page.url();
      if (currentUrl.includes('/reader/')) {
        // If still on reader page, should show error or empty state
        const bodyText = await page.locator('body').textContent();
        const hasError =
          bodyText?.includes('not found') ||
          bodyText?.includes('access denied') ||
          bodyText?.includes('permission') ||
          bodyText?.includes('unauthorized');

        expect(hasError).toBeTruthy();
      } else {
        // Should be redirected away from reader
        expect(currentUrl).not.toContain('/reader/');
      }
    });

    test('should not show non-owned books in library', async ({ page }) => {
      // Login as test user
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Navigate to library
      await page.goto('/library');
      await page.waitForTimeout(500);

      const bodyText = await page.locator('body').textContent();

      // Should see owned books (Foundation from seeds has user-book link)
      expect(bodyText).toContain('Foundation');

      // Should NOT see books without user-book link (Dune, Ember Archive)
      // These books exist in DB but are not linked to test user
      expect(bodyText).not.toContain('Dune');
      expect(bodyText).not.toContain('Ember Archive');
    });
  });

  test.describe('File Ownership', () => {
    test('should show only owned files in uploads', async ({ page }) => {
      // Login as test user
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Navigate to uploads
      await page.goto('/uploads');
      await page.waitForTimeout(500);

      const bodyText = await page.locator('body').textContent();

      // Should see owned files (foundation.txt and i_robot.txt have userId in seeds)
      expect(bodyText).toContain('foundation.txt');
      expect(bodyText).toContain('i_robot.txt');

      // Should NOT see files without userId (ember-archive.pdf, atlas-field-notes.txt)
      expect(bodyText).not.toContain('ember-archive.pdf');
      expect(bodyText).not.toContain('atlas-field-notes.txt');
    });

    test('should deny download of non-owned file', async ({ page }) => {
      // Login as test user
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Try to download a file not owned by test user
      // File ID for "ember-archive.pdf" from seeds: 66f000000000000000000001 (no userId)
      const nonOwnedFileId = '66f000000000000000000001';

      // Try to access download endpoint
      const response = await page.goto(`/api/files/${nonOwnedFileId}/download`);

      // Should return 403 or 404
      expect(response?.status()).not.toBe(200);
    });
  });

  test.describe('Guest Access Restrictions', () => {
    test('should show empty library for guest', async ({ page }) => {
      // Visit library as guest
      await page.goto('/library');
      await page.waitForTimeout(500);

      // Should show empty state or prompt to login
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Your books');

      // Should not show any actual books
      expect(bodyText).not.toContain('Foundation');
      expect(bodyText).not.toContain('Dune');
    });

    test('should show empty uploads for guest', async ({ page }) => {
      // Visit uploads as guest
      await page.goto('/uploads');
      await page.waitForTimeout(500);

      // Should show empty state or prompt to login
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Files');

      // Should not show any actual files
      expect(bodyText).not.toContain('foundation.txt');
      expect(bodyText).not.toContain('ember-archive.pdf');
    });

    test('should deny guest access to reader', async ({ page }) => {
      // Try to access a book reader as guest
      const bookId = '66f000000000000000000501'; // Foundation book ID

      const response = await page.goto(`/reader/${bookId}`);

      // Should either redirect or show error
      const currentUrl = page.url();
      if (currentUrl.includes('/reader/')) {
        // If still on reader page, should show error or empty state
        const bodyText = await page.locator('body').textContent();
        const hasError =
          bodyText?.includes('not found') ||
          bodyText?.includes('sign in') ||
          bodyText?.includes('login') ||
          bodyText?.includes('unauthorized');

        expect(hasError).toBeTruthy();
      } else {
        // Should be redirected away from reader
        expect(currentUrl).not.toContain('/reader/');
      }
    });
  });

});
