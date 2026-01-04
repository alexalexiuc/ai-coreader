import { expect, test } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.describe('Registration', () => {
    test('should register a new user successfully', async ({ page }) => {
      await page.goto('/');

      // Open registration modal
      await page.getByRole('button', { name: /Register/i }).first().click();

      // Wait for modal to be visible
      await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();

      // Fill registration form with unique email
      const uniqueEmail = `test${Date.now()}@example.com`;
      await page.getByLabel(/Email/i).fill(uniqueEmail);
      await page.getByLabel(/^Password$/i).fill('NewPassword123!');
      await page.getByLabel(/First Name/i).fill('New');
      await page.getByLabel(/Last Name/i).fill('User');

      // Submit form
      await page.getByRole('button', { name: /Sign Up/i }).click();

      // Wait for registration to complete and user to be logged in
      await page.waitForTimeout(1000);

      // Verify user is logged in - should see dashboard greeting or user menu
      // The dashboard should show authenticated state
      await expect(page.getByText(/Your reading dashboard/i)).toBeVisible();
      
      // Should NOT see guest CTAs anymore
      const registerButton = page.getByRole('button', { name: /Register/i }).first();
      await expect(registerButton).not.toBeVisible();
    });

    test('should show error when registering with existing email', async ({ page }) => {
      await page.goto('/');

      // Open registration modal
      await page.getByRole('button', { name: /Register/i }).first().click();

      // Try to register with existing test user email
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/^Password$/i).fill('SomePassword123!');
      await page.getByLabel(/First Name/i).fill('Duplicate');
      await page.getByLabel(/Last Name/i).fill('User');

      // Submit form
      await page.getByRole('button', { name: /Sign Up/i }).click();

      // Wait for error message
      await page.waitForTimeout(500);

      // Should show error about email already registered
      await expect(page.getByText(/already registered/i)).toBeVisible();
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/');

      // Open registration modal
      await page.getByRole('button', { name: /Register/i }).first().click();

      // Try to register with short password
      await page.getByLabel(/Email/i).fill('shortpass@example.com');
      await page.getByLabel(/^Password$/i).fill('short');
      await page.getByLabel(/First Name/i).fill('Short');
      await page.getByLabel(/Last Name/i).fill('Pass');

      // Submit form
      await page.getByRole('button', { name: /Sign Up/i }).click();

      // Wait for error message
      await page.waitForTimeout(500);

      // Should show password length error
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    });
  });

  test.describe('Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      await page.goto('/');

      // Open login modal
      await page.getByRole('button', { name: /Log in/i }).first().click();

      // Wait for modal to be visible
      await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();

      // Fill login form with test user
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');

      // Submit form
      await page.getByRole('button', { name: /Sign In/i }).click();

      // Wait for login to complete
      await page.waitForTimeout(1000);

      // Verify user is logged in
      await expect(page.getByText(/Your reading dashboard/i)).toBeVisible();
      
      // Should NOT see guest CTAs anymore
      const loginButton = page.getByRole('button', { name: /Log in/i }).first();
      await expect(loginButton).not.toBeVisible();
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto('/');

      // Open login modal
      await page.getByRole('button', { name: /Log in/i }).first().click();

      // Try to login with wrong password
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('WrongPassword123!');

      // Submit form
      await page.getByRole('button', { name: /Sign In/i }).click();

      // Wait for error message
      await page.waitForTimeout(500);

      // Should show invalid credentials error
      await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
    });

    test('should persist session after page reload', async ({ page }) => {
      await page.goto('/');

      // Login
      await page.getByRole('button', { name: /Log in/i }).first().click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Reload page
      await page.reload();
      await page.waitForTimeout(500);

      // User should still be logged in
      const loginButton = page.getByRole('button', { name: /Log in/i }).first();
      await expect(loginButton).not.toBeVisible();
      await expect(page.getByText(/Your reading dashboard/i)).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('should logout and return to guest state', async ({ page }) => {
      await page.goto('/');

      // Login first
      await page.getByRole('button', { name: /Log in/i }).first().click();
      await page.getByLabel(/Email/i).fill('testuser@example.com');
      await page.getByLabel(/Password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await page.waitForTimeout(1000);

      // Click logout (in user menu or header)
      // Look for "Log out" link or button
      const logoutLink = page.getByRole('link', { name: /Log out/i });
      const logoutButton = page.getByRole('button', { name: /Log out/i });
      
      if (await logoutLink.isVisible()) {
        await logoutLink.click();
      } else if (await logoutButton.isVisible()) {
        await logoutButton.click();
      } else {
        // Might be in a dropdown menu - try to find it
        const accountLink = page.getByRole('link', { name: /Account/i }).or(page.getByRole('link', { name: /Profile/i }));
        if (await accountLink.isVisible()) {
          await accountLink.click();
          await page.waitForTimeout(300);
        }
        // Try logout again
        const logoutElement = page.getByText(/Log out/i).first();
        await logoutElement.click();
      }

      await page.waitForTimeout(500);

      // Should be back to guest state
      await expect(page.getByRole('button', { name: /Log in/i }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Register/i }).first()).toBeVisible();
      
      // Dashboard should show guest messaging
      await expect(page.getByText(/Create an account/i)).toBeVisible();
    });
  });
});
