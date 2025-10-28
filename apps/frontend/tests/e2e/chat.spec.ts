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

test.describe('Chat Functionality', () => {
  test('should send a message and receive a response', async ({ page }) => {
    const consoleErrors = trackConsoleErrors(page);
    await page.goto('/chat');
    await expect(page.locator('[data-testid="chat-composer"]')).toBeVisible();

    // Type and send message
    await page.fill('[data-testid="input"]', 'Hello, how are you?');
    await page.click('[data-testid="send"]');

    // Wait for response to stream
    const responseTag = page.locator('[data-testid="response"]').first();
    await expect(responseTag).toBeVisible();
    await expect(responseTag).toContainText('assistant');

    // All console errors should be surfaced as test failures
    expect(consoleErrors).toEqual([]);
  });

  test('should handle voice recording', async ({ page }) => {
    await page.goto('/chat');

    // Click mic button to start recording (mock or skip actual audio)
    await page.click('[data-testid="mic-button"]');

    const recordingIndicator = page.locator('[data-testid="recording-indicator"]');
    const microphoneError = page.getByText('Unable to access microphone.');

    let recordingStarted = true;
    try {
      await recordingIndicator.waitFor({ state: 'visible', timeout: 2000 });
    } catch {
      recordingStarted = false;
    }

    if (recordingStarted) {
      await page.click('[data-testid="mic-button"]');
      await expect(recordingIndicator).not.toBeVisible();
    } else {
      await expect(microphoneError).toBeVisible();
      await expect(recordingIndicator).toHaveCount(0);
    }
  });

  test('should toggle tools and audio', async ({ page }) => {
    await page.goto('/chat');

    const toolsStatus = page.locator('[data-testid="tools-active"]');
    // Tools are enabled by default
    await expect(toolsStatus).toBeVisible();

    // Toggle tools off
    await page.click('[data-testid="toggle-tools"]');
    await expect(toolsStatus).toHaveCount(0);

    // Toggle tools back on
    await page.click('[data-testid="toggle-tools"]');
    await expect(toolsStatus).toBeVisible();

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
