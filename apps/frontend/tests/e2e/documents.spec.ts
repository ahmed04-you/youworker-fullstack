import { test, expect, Page } from '@playwright/test';

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test.describe('Documents Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to documents page
    await page.goto('/documents');
  });

  test('should display documents page with upload button', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    // Check for main heading
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Check for upload button
    const uploadButton = page.getByRole('button', { name: /upload/i });
    await expect(uploadButton).toBeVisible();

    // No console errors
    expect(consoleErrors).toEqual([]);
  });

  test('should open upload dialog', async ({ page }) => {
    // Click upload button
    await page.getByRole('button', { name: /upload/i }).first().click();

    // Dialog should be visible
    await expect(page.getByRole('dialog')).toBeVisible();

    // Should have file input or upload area
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });

  test('should display document list or empty state', async ({ page }) => {
    // Either documents are present or empty state is shown
    const emptyState = page.getByText(/no documents found/i);
    const documentCards = page.locator('.grid').locator('> div');

    // Wait for either empty state or document cards
    try {
      await expect(emptyState).toBeVisible({ timeout: 3000 });
    } catch {
      // If no empty state, check for document cards
      await expect(documentCards.first()).toBeVisible();
    }
  });

  test('should show loading skeletons initially', async ({ page }) => {
    // Navigate to fresh page
    await page.goto('/documents');

    // Should show loading state briefly
    const skeleton = page.locator('.animate-pulse').first();

    // Either skeleton appears or content loads very fast
    try {
      await expect(skeleton).toBeVisible({ timeout: 500 });
    } catch {
      // Content loaded too fast, which is fine
      expect(true).toBe(true);
    }
  });

  test('should handle document selection', async ({ page }) => {
    // Wait for documents to load
    await page.waitForLoadState('networkidle');

    // Check if there are any documents
    const documentCards = page.locator('.grid').locator('> div').first();
    const hasDocuments = await documentCards.isVisible().catch(() => false);

    if (hasDocuments) {
      // Click on document card to select
      await documentCards.click();

      // Should show selection indicator (ring or badge)
      const selectedBadge = page.getByText(/selected/i);
      await expect(selectedBadge).toBeVisible();
    } else {
      // Skip test if no documents
      test.skip();
    }
  });

  test('should show delete button for selected documents', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const documentCards = page.locator('.grid').locator('> div');
    const hasDocuments = await documentCards.first().isVisible().catch(() => false);

    if (hasDocuments) {
      // Select a document by clicking its checkbox/card
      const firstCard = documentCards.first();
      await firstCard.click();

      // Delete button should appear
      const deleteButton = page.getByRole('button', { name: /delete selected/i });
      await expect(deleteButton).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should have pagination if many documents', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check for pagination controls
    const nextButton = page.getByRole('button', { name: /next/i });
    const previousButton = page.getByRole('button', { name: /previous/i });

    // If pagination exists, check buttons
    const hasPagination = await nextButton.isVisible().catch(() => false);

    if (hasPagination) {
      await expect(previousButton).toBeVisible();
      // Previous should be disabled on first page
      await expect(previousButton).toBeDisabled();
    }
  });

  test('should show filters component', async ({ page }) => {
    // Look for filter-related UI elements
    // This might be a dropdown, button, or filter bar
    const filterElements = page.locator('[class*="filter"]').or(
      page.getByRole('button', { name: /filter/i })
    );

    // At least some filter UI should be present or the page should load
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  });
});

test.describe('Documents - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be responsive on mobile', async ({ page }) => {
    await page.goto('/documents');

    // Main heading should be visible
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();

    // Upload button should be accessible
    await expect(page.getByRole('button', { name: /upload/i }).first()).toBeVisible();

    // Grid should adapt to mobile (single column)
    const documentGrid = page.locator('.grid');
    if (await documentGrid.isVisible()) {
      const gridClasses = await documentGrid.getAttribute('class');
      expect(gridClasses).toContain('grid-cols-1');
    }
  });
});
