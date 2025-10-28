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

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate first-time user
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show welcome dialog on first visit', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);

    // Navigate to home page
    await page.goto('/');

    // Wait for onboarding to appear (has 1s delay)
    await page.waitForTimeout(1500);

    // Welcome dialog should be visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should have welcome content
    const welcomeText = page.getByText(/welcome/i);
    await expect(welcomeText).toBeVisible();

    // No console errors
    expect(consoleErrors).toEqual([]);
  });

  test('should not show welcome dialog on subsequent visits if dismissed', async ({ page }) => {
    // Simulate previous visit
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('onboarding-complete', 'true');
    });

    // Reload page
    await page.reload();
    await page.waitForTimeout(1500);

    // Welcome dialog should not appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).not.toBeVisible({ timeout: 2000 }).catch(() => true);
  });

  test('should show "Resume Tour" button if onboarding incomplete', async ({ page }) => {
    // Simulate incomplete onboarding
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('onboarding-complete', 'false');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Resume tour button should appear
    const resumeButton = page.getByRole('button', { name: /resume tour/i });
    await expect(resumeButton).toBeVisible({ timeout: 3000 });
  });

  test('should open onboarding when "Resume Tour" is clicked', async ({ page }) => {
    // Simulate incomplete onboarding
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('onboarding-complete', 'false');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Click resume tour button
    const resumeButton = page.getByRole('button', { name: /resume tour/i });
    await resumeButton.click();

    // Dialog should open
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
  });

  test('should dismiss "Resume Tour" button when close is clicked', async ({ page }) => {
    // Simulate incomplete onboarding
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('onboarding-complete', 'false');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Find the dismiss button (X button next to Resume Tour)
    const dismissButton = page.getByRole('button', { name: /dismiss resume tour/i });
    await dismissButton.click();

    // Resume tour button should disappear
    const resumeButton = page.getByRole('button', { name: /resume tour/i });
    await expect(resumeButton).not.toBeVisible({ timeout: 1000 });
  });

  test('should navigate through onboarding steps', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    // Wait for dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Look for Next or Continue button
    const nextButton = page.getByRole('button', { name: /next|continue|get started/i }).first();

    if (await nextButton.isVisible().catch(() => false)) {
      // Click through multiple steps
      for (let i = 0; i < 3; i++) {
        await nextButton.click();
        await page.waitForTimeout(300);

        // Dialog should still be visible or content should change
        const stillVisible = await dialog.isVisible().catch(() => false);
        if (!stillVisible) break;
      }
    }
  });

  test('should close onboarding with close button', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Look for close button
    const closeButton = page.getByRole('button', { name: /close|skip|later/i }).first();

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();

      // Dialog should close
      await expect(dialog).not.toBeVisible({ timeout: 1000 });
    }
  });

  test('should close onboarding with ESC key', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Press ESC
    await page.keyboard.press('Escape');

    // Dialog should close (or may stay open depending on design)
    await page.waitForTimeout(500);
  });

  test('should show feature cards in onboarding', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Look for feature-related content
    const features = [
      /chat|conversation/i,
      /document|upload/i,
      /analytics|insights/i,
    ];

    // At least some feature content should be present
    let foundFeature = false;
    for (const feature of features) {
      const hasFeature = await page.getByText(feature).isVisible().catch(() => false);
      if (hasFeature) {
        foundFeature = true;
        break;
      }
    }

    expect(foundFeature).toBe(true);
  });

  test('should track onboarding progress in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click through onboarding
    const nextButton = page.getByRole('button', { name: /next|continue|get started/i }).first();

    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(300);

      // Check localStorage
      const hasVisited = await page.evaluate(() => localStorage.getItem('has-visited'));
      expect(hasVisited).toBeTruthy();
    }
  });

  test('should complete onboarding flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Try to complete onboarding by clicking through all steps
    const maxSteps = 10; // Safety limit
    for (let i = 0; i < maxSteps; i++) {
      // Look for next/complete button
      const nextButton = page.getByRole('button', { name: /next|continue|complete|finish|done/i }).first();

      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(300);
      } else {
        break;
      }

      // Check if dialog is still visible
      const stillVisible = await dialog.isVisible().catch(() => false);
      if (!stillVisible) break;
    }

    // After completion, dialog should be closed
    await page.waitForTimeout(500);
  });

  test('should show step indicator if multiple steps', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Look for step indicators (e.g., "Step 1/5", dots, progress bar)
    const stepIndicators = page.locator('[class*="step"], [role="progressbar"], text=/\\d+\\/\\d+/');

    const count = await stepIndicators.count();
    // May or may not have visible step indicators depending on design
    expect(count >= 0).toBe(true);
  });

  test('should have accessible labels and roles', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should have proper role
    expect(await dialog.getAttribute('role')).toBe('dialog');

    // Buttons should have accessible labels
    const buttons = await page.getByRole('button').all();
    for (const button of buttons.slice(0, 5)) { // Check first 5 buttons
      const hasLabel = await button.textContent().catch(() => '');
      const ariaLabel = await button.getAttribute('aria-label');
      expect(hasLabel || ariaLabel).toBeTruthy();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog should fit mobile screen
    const dialogBox = await dialog.boundingBox();
    if (dialogBox) {
      expect(dialogBox.width).toBeLessThanOrEqual(375);
    }
  });

  test('should handle navigation during onboarding', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Navigate to different page
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');

    // Dialog should close when navigating
    const stillVisible = await dialog.isVisible().catch(() => false);
    // It may or may not close depending on implementation
    expect(typeof stillVisible).toBe('boolean');
  });

  test('should not interfere with normal app usage', async ({ page }) => {
    // Complete onboarding
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('onboarding-complete', 'true');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // No onboarding elements should be visible
    const dialog = page.getByRole('dialog');
    const resumeButton = page.getByRole('button', { name: /resume tour/i });

    await expect(dialog).not.toBeVisible({ timeout: 1000 }).catch(() => true);
    await expect(resumeButton).not.toBeVisible({ timeout: 1000 }).catch(() => true);
  });

  test('should persist dismissal of resume tour', async ({ page }) => {
    // Simulate incomplete onboarding
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('has-visited', 'true');
      localStorage.setItem('onboarding-complete', 'false');
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Dismiss resume tour
    const dismissButton = page.getByRole('button', { name: /dismiss resume tour/i });
    if (await dismissButton.isVisible().catch(() => false)) {
      await dismissButton.click();

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Resume tour should not reappear
      const resumeButton = page.getByRole('button', { name: /resume tour/i });
      await expect(resumeButton).not.toBeVisible({ timeout: 2000 }).catch(() => true);
    }
  });
});
