import { test, expect } from '@playwright/test';

test.describe('Chat Functionality', () => {
  test('should send a message and receive a response', async ({ page }) => {
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-composer"]')).toBeVisible();

    // Type and send message
    await page.fill('[data-testid="input"]', 'Hello, how are you?');
    await page.click('[data-testid="send"]');

    // Wait for response to stream
    await expect(page.locator('[data-testid="response"]')).toBeVisible();
    await expect(page.locator('[data-testid="response"]')).toContainText('assistant');

    // Verify no errors in console
    await expect(page.locator('body')).toHaveNoConsoleErrors();
  });

  test('should handle voice recording', async ({ page }) => {
    await page.goto('/chat');

    // Click mic button to start recording (mock or skip actual audio)
    await page.click('[data-testid="mic-button"]');
    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();

    // Stop recording
    await page.click('[data-testid="mic-button"]');
    await expect(page.locator('[data-testid="recording-indicator"]')).not.toBeVisible();

    // Verify transcript appears (if mocked)
    await expect(page.locator('[data-testid="transcript"]')).toBeVisible();
  });

  test('should toggle tools and audio', async ({ page }) => {
    await page.goto('/chat');

    // Toggle tools
    await page.click('[data-testid="toggle-tools"]');
    await expect(page.locator('[data-testid="tools-active"]')).toBeVisible();

    // Toggle audio
    await page.click('[data-testid="toggle-audio"]');
    await expect(page.locator('[data-testid="voice-on"]')).toBeVisible();
  });

  test('should start new session', async ({ page }) => {
    await page.goto('/chat');

    // Send initial message
    await page.fill('[data-testid="input"]', 'First message');
    await page.click('[data-testid="send"]');
    await expect(page.locator('[data-testid="messages"]')).toHaveCount(2);

    // Start new session
    await page.click('[data-testid="new-session"]');
    await expect(page.locator('[data-testid="messages"]')).toHaveCount(0);
  });
});