import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from '@playwright/test';
import { closeDb, resetUploadsFixtures } from './utils/db';

test.beforeEach(async () => {
  await resetUploadsFixtures();
});

test.afterAll(async () => {
  await closeDb();
});

test.describe('Uploads page', () => {
  test('lists uploads with filtering, searching, and sorting', async ({ page }) => {
    await page.goto('/uploads');

    await expect(page.getByRole('heading', { name: 'Files' })).toBeVisible();
    const rows = page.getByTestId('upload-row');
    await expect(rows).toHaveCount(3);

    await expect(rows.filter({ hasText: 'completed_story.txt' }).getByText('Completed')).toBeVisible();
    await expect(rows.filter({ hasText: 'draft_processing.txt' }).getByText('Processing')).toBeVisible();
    await expect(rows.filter({ hasText: 'broken_upload.txt' }).getByText('Failed')).toBeVisible();

    await page.getByRole('button', { name: /Failed/ }).click();
    await expect(page.getByTestId('upload-row')).toHaveCount(1);
    await expect(page.getByTestId('upload-row').first()).toHaveAttribute('data-file-name', 'broken_upload.txt');

    await page.getByRole('button', { name: /All/ }).click();
    await expect(rows).toHaveCount(3);

    await page.getByPlaceholder('Search files...').fill('draft');
    await expect(page.getByTestId('upload-row')).toHaveCount(1);
    await expect(page.getByTestId('upload-row').first()).toHaveAttribute('data-file-name', 'draft_processing.txt');

    await page.getByPlaceholder('Search files...').fill('');
    await page.getByRole('button', { name: 'Sort' }).click();
    await page.getByRole('option', { name: /^File name A-Z/ }).click();

    const sortedNames = await page
      .getByTestId('upload-row')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-file-name')));

    expect(sortedNames).toEqual(['broken_upload.txt', 'completed_story.txt', 'draft_processing.txt']);
  });

  test('uploads a new file and shows it after reload', async ({ page }) => {
    await page.goto('/uploads');

    const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coreader-upload-'));
    const fixtureFile = path.join(fixtureDir, 'playwright-upload.txt');
    await fs.writeFile(fixtureFile, 'playwright upload text content');

    await page.locator('input[type="file"]').setInputFiles(fixtureFile);
    await page.getByRole('button', { name: 'Upload book' }).click();
    await expect(
      page.getByText('Uploaded! We will process the book and add it to your library shortly.', { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('upload-row')).toHaveCount(4);
    await expect(page.getByTestId('upload-row').first()).toHaveAttribute('data-file-name', 'playwright-upload.txt');
  });
});
