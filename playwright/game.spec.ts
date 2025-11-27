import { test, expect } from '@playwright/test';

test.describe('Žolíky 95 Game Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the game and wait for initialization
    await page.goto('/');
    // Close the start screen by starting a new game like a real player
    await page.getByRole('button', { name: 'Start Game' }).click();
    await page.waitForSelector('#player-hand .card');
  });

  test('should load the game correctly with 13 cards', async ({ page }) => {
    await expect(page).toHaveTitle(/Žolíky/);
    
    // Player should start with 13 cards (Round 1)
    const cards = page.locator('#player-hand .card');
    await expect(cards).toHaveCount(13);
    
    // Status should indicate discard action
    const status = page.locator('#status-text');
    await expect(status).toContainText(/Discard/i);
  });

  test('should not allow drawing on turn 1 (must discard)', async ({ page }) => {
    // Attempt to click stock
    await page.locator('#stock-pile').click();
    
    // Hand count should remain 13
    await expect(page.locator('#player-hand .card')).toHaveCount(13);
  });

  test('should complete turn 1 by discarding', async ({ page }) => {
    // 1. Select a card (click the last one)
    const lastCard = page.locator('#player-hand .card').last();
    await lastCard.click();
    
    // Verify selection
    await expect(lastCard).toHaveClass(/selected/);
    
    // 2. Click Discard
    await page.locator('#btn-discard').click();

    // 3. Verify card leaves hand (13 -> 12)
    await expect(page.locator('#player-hand .card')).toHaveCount(12);

    // 4. Verify game proceeds (CPU turn kicks in or control returns for round 2)
    await expect(page.locator('#status-text')).toContainText(/CPU|Round 2/i);
  });

  test('should allow drawing in round 2', async ({ page }) => {
    // 1. Play Turn 1 (Discard)
    await page.locator('#player-hand .card').last().click();
    await page.locator('#btn-discard').click();
    
    // 2. Wait for CPU turn to finish (it has a timeout of 1000ms)
    // Wait for status to indicate it's Human turn again (Round 2)
    await expect(page.locator('#status-text')).toContainText(/Your turn/i, { timeout: 10000 });
    await expect(page.locator('#score-text')).toContainText(/Rd: 2/);
    
    // 3. Round 2: Now we can Draw
    // Hand size is 12 (after discard) -> CPU turn (no change to our hand) -> Draw (13)
    await expect(page.locator('#player-hand .card')).toHaveCount(12);
    
    await page.locator('#stock-pile').click();
    
    // 4. Verify hand size increases
    await expect(page.locator('#player-hand .card')).toHaveCount(13);
  });
});
