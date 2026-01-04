import { expect, Page, test } from '@playwright/test';

async function navigateToReader(page: Page) {
  await page.goto('/library');
  const emberArchiveLink = page.getByRole('link', { name: /The Ember Archive/i }).first();

  if (await emberArchiveLink.isVisible()) {
    await emberArchiveLink.click();
  } else {
    await page.goto('/reader/66f000000000000000000101');
  }

  await expect(page.locator('[data-block-id="b-0-0"]')).toBeVisible();
}

test.describe('Reader Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToReader(page);
  });

  test('highlights entities on hover without tinting other words', async ({ page }) => {
    const emberEntity = page.locator('[data-entity-id]', { hasText: 'Ember Archive' }).first();
    const rinEntity = page.locator('[data-entity-id]', { hasText: /^Rin$/ }).first();

    await emberEntity.scrollIntoViewIfNeeded();

    const emberBgBefore = await emberEntity.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rinBgBefore = await rinEntity.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(emberBgBefore);

    await emberEntity.hover();

    const emberBgAfter = await emberEntity.evaluate((el) => getComputedStyle(el).backgroundColor);
    const rinBgAfter = await rinEntity.evaluate((el) => getComputedStyle(el).backgroundColor);

    expect(emberBgAfter).not.toBe(emberBgBefore);
    expect(emberBgAfter).not.toBe('rgba(0, 0, 0, 0)');
    expect(rinBgAfter).toBe(rinBgBefore);
  });

  test('renders entity tokens at the correct positions', async ({ page }) => {
    const firstBlock = page.locator('[data-block-id="b-0-0"]');
    await expect(firstBlock).toContainText('Ash and memory are carefully stored in the Ember Archive.');

    const entityTokens = firstBlock.locator('[data-entity-id]');
    await expect(entityTokens).toHaveCount(2);

    const tokenTexts = (await entityTokens.allInnerTexts()).map((t) => t.trim());
    expect(tokenTexts).toEqual(expect.arrayContaining(['Ember Archive', 'Rin']));

    const blockText = (await firstBlock.innerText()).trim();
    expect(blockText).toContain(
      'Ash and memory are carefully stored in the Ember Archive. The archivist Rin catalogues accounts of cities lost to time, noting flickers of magic that still cling to their ruins.',
    );
  });
});
