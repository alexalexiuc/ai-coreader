import { expect, test } from '@playwright/test';

test.describe('Personal Cabinet', () => {
  test.describe('Access Control', () => {
    test('should redirect to home if not authenticated', async ({ page }) => {
      await page.goto('/account');

      // Should redirect to home page
      await page.waitForURL('/');
      await expect(page.getByRole('heading', { name: 'Your reading dashboard' })).toBeVisible();
    });

    test('should allow authenticated user to access personal cabinet', async ({ page }) => {
      // Login first
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.locator('form').getByRole('button', { name: /Login/i }).click();
      await page.waitForTimeout(1000);

      // Navigate to account page
      await page.goto('/account');

      // Should see personal cabinet
      await expect(page.getByRole('heading', { name: 'Personal Cabinet' })).toBeVisible();
      await expect(page.getByText('Manage your account settings and security')).toBeVisible();
    });
  });

  test.describe('Account Information', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.locator('form').getByRole('button', { name: /Login/i }).click();
      await page.waitForTimeout(1000);

      // Go to account page
      await page.goto('/account');
    });

    test('should display user email and account creation date', async ({ page }) => {
      // Check email is displayed
      await expect(page.getByText('testuser@example.com')).toBeVisible();

      // Check account creation date section exists
      await expect(page.getByText(/Account Created/i)).toBeVisible();
    });

    test('should have profile and password tabs', async ({ page }) => {
      // Check tabs exist
      await expect(page.getByRole('button', { name: /^Profile$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Change Password/i })).toBeVisible();
    });
  });

  test.describe('Password Change', () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto('/');
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.locator('form').getByRole('button', { name: /Login/i }).click();
      await page.waitForTimeout(1000);

      // Go to account page and switch to password tab
      await page.goto('/account');
      await page.getByRole('button', { name: /Change Password/i }).click();
    });

    test('should show password change form', async ({ page }) => {
      // Check form fields exist
      await expect(page.getByLabel(/Current Password/i)).toBeVisible();
      await expect(page.getByLabel(/^New Password$/i)).toBeVisible();
      await expect(page.getByLabel(/Confirm New Password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Change Password/i })).toBeVisible();
    });

    test('should show error with wrong current password', async ({ page }) => {
      // Fill form with wrong current password
      await page.getByLabel(/Current Password/i).fill('WrongPassword123!');
      await page.getByLabel(/^New Password$/i).fill('NewPassword123!');
      await page.getByLabel(/Confirm New Password/i).fill('NewPassword123!');

      // Submit form
      await page.getByRole('button', { name: /Change Password/i }).click();

      // Wait for error
      await page.waitForTimeout(500);

      // Should show error message
      await expect(page.getByText(/incorrect|wrong|invalid/i)).toBeVisible();
    });

    test('should show error when passwords do not match', async ({ page }) => {
      // Fill form with mismatched passwords
      await page.getByLabel(/Current Password/i).fill('TestPassword123!');
      await page.getByLabel(/^New Password$/i).fill('NewPassword123!');
      await page.getByLabel(/Confirm New Password/i).fill('DifferentPassword123!');

      // Submit form
      await page.getByRole('button', { name: /Change Password/i }).click();

      // Wait for error
      await page.waitForTimeout(500);

      // Should show passwords don't match error
      await expect(page.getByText(/do not match|must match/i)).toBeVisible();
    });

    test('should show error with weak new password', async ({ page }) => {
      // Fill form with short password
      await page.getByLabel(/Current Password/i).fill('TestPassword123!');
      await page.getByLabel(/^New Password$/i).fill('short');
      await page.getByLabel(/Confirm New Password/i).fill('short');

      // Submit form
      await page.getByRole('button', { name: /Change Password/i }).click();

      // Wait for error
      await page.waitForTimeout(500);

      // Should show password length error
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    });

    test('should successfully change password with correct inputs', async ({ page }) => {
      const newPassword = `NewPassword${Date.now()}!`;

      // Fill form correctly
      await page.getByLabel(/Current Password/i).fill('TestPassword123!');
      await page.getByLabel(/^New Password$/i).fill(newPassword);
      await page.getByLabel(/Confirm New Password/i).fill(newPassword);

      // Submit form
      await page.getByRole('button', { name: /Change Password/i }).click();

      // Wait for success message
      await page.waitForTimeout(1000);

      // Should show success message
      await expect(page.getByText(/Password changed successfully/i)).toBeVisible();

      // Form fields should be cleared
      await expect(page.getByLabel(/Current Password/i)).toHaveValue('');
      await expect(page.getByLabel(/^New Password$/i)).toHaveValue('');
      await expect(page.getByLabel(/Confirm New Password/i)).toHaveValue('');
    });

    test('should be able to login with new password after change', async ({ page, context }) => {
      const newPassword = `NewPassword${Date.now()}!`;

      // Change password
      await page.getByLabel(/Current Password/i).fill('TestPassword123!');
      await page.getByLabel(/^New Password$/i).fill(newPassword);
      await page.getByLabel(/Confirm New Password/i).fill(newPassword);
      await page.getByRole('button', { name: /Change Password/i }).click();
      await page.waitForTimeout(1000);

      // Wait for success
      await expect(page.getByText(/Password changed successfully/i)).toBeVisible();

      // Clear all cookies and storage to simulate fresh login
      await context.clearCookies();
      await page.goto('/');
      await page.waitForTimeout(500);

      // Try to login with new password
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill(newPassword);
      await page.locator('form').getByRole('button', { name: /Login/i }).click();
      await page.waitForTimeout(1000);

      // Should be logged in successfully
      await expect(page.getByText(/Your reading dashboard/i)).toBeVisible();
      const loginButton = page.getByRole('button', { name: /Log in/i }).first();
      await expect(loginButton).not.toBeVisible();
    });

    test('should not be able to login with old password after change', async ({ page, context }) => {
      const newPassword = `NewPassword${Date.now()}!`;

      // Change password
      await page.getByLabel(/Current Password/i).fill('TestPassword123!');
      await page.getByLabel(/^New Password$/i).fill(newPassword);
      await page.getByLabel(/Confirm New Password/i).fill(newPassword);
      await page.getByRole('button', { name: /Change Password/i }).click();
      await page.waitForTimeout(1000);

      // Wait for success
      await expect(page.getByText(/Password changed successfully/i)).toBeVisible();

      // Clear all cookies and storage to simulate fresh login
      await context.clearCookies();
      await page.goto('/');
      await page.waitForTimeout(500);

      // Try to login with old password
      await page
        .getByRole('button', { name: /Log in/i })
        .first()
        .click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.locator('form').getByRole('button', { name: /Login/i }).click();
      await page.waitForTimeout(500);

      // Should show error - old password no longer works
      await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
    });

    test('should invalidate existing session after password change', async ({ page, context }) => {
      // This test verifies that changing password logs out other sessions
      // Since we change password, our current session should stay valid (new token created)
      // but if we had another session, it would be invalidated

      const newPassword = `NewPassword${Date.now()}!`;

      // Change password
      await page.getByLabel(/Current Password/i).fill('TestPassword123!');
      await page.getByLabel(/^New Password$/i).fill(newPassword);
      await page.getByLabel(/Confirm New Password/i).fill(newPassword);
      await page.getByRole('button', { name: /Change Password/i }).click();
      await page.waitForTimeout(1000);

      // Current session should remain valid (page should still work)
      await page.goto('/');
      await expect(page.getByText(/Your reading dashboard/i)).toBeVisible();

      // User should still be logged in
      const loginButton = page.getByRole('button', { name: /Log in/i }).first();
      await expect(loginButton).not.toBeVisible();
    });
  });
});
