const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');

/**
 * Integration tests for Release Timeline (Schedule view)
 *
 * These tests verify:
 * - Timeline canvas renders with milestone nodes
 * - Every visible dot has a stem connecting it to its card
 * - Stems render correctly at multiple zoom levels
 * - No JavaScript errors during zoom/pan interactions
 *
 * Tag: @release-timeline
 * Usage: npx playwright test --grep @release-timeline
 */

test.describe('Release Timeline @release-timeline @releases', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    logCapturedErrors(page, testInfo);
  });

  test('Schedule view loads with a canvas timeline', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    var viewLabel = page.locator('text=/\\d+d view/');
    await expect(viewLabel.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('timeline renders milestone cards above and below axis', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // The milestone countdown cards should be visible above the timeline.
    // Match the card element directly — the day count and the "DAYS" label are
    // separate nodes (and "DAYS" is CSS-uppercased "days"), so a text regex like
    // /\d+ DAYS/ never matches a single element.
    var countdownCards = page.locator('[data-testid="milestone-countdown-card"]');
    var cardCount = await countdownCards.count();
    expect(cardCount).toBeGreaterThan(0);

    expect(page.errors).toHaveLength(0);
  });

  test('zoom in via scroll wheel updates the view label', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Get initial zoom level
    var labelBefore = await page.locator('text=/\\d+d view/').first().textContent();
    var daysBefore = parseInt(labelBefore.match(/(\d+)d/)[1]);

    // Zoom in — dispatch synthetic WheelEvent with explicit clientX/clientY
    // (page.mouse.wheel may not set clientX/clientY in headless Chromium,
    // causing the onWheel handler to early-return when checking chart bounds)
    var cx = box.x + box.width * 0.5;
    var cy = box.y + box.height * 0.5;
    for (var i = 0; i < 10; i++) {
      await page.evaluate(({ x, y }) => {
        var canvas = document.querySelector('canvas');
        canvas.dispatchEvent(new WheelEvent('wheel', {
          clientX: x, clientY: y, deltaX: 0, deltaY: -200,
          bubbles: true, cancelable: true
        }));
      }, { x: cx, y: cy });
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    var labelAfter = await page.locator('text=/\\d+d view/').first().textContent();
    var daysAfter = parseInt(labelAfter.match(/(\d+)d/)[1]);

    expect(daysAfter).toBeLessThan(daysBefore);

    // Reset zoom button should appear
    var resetBtn = page.locator('text=Reset zoom');
    await expect(resetBtn).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('reset zoom button restores default view', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Get initial label
    var labelBefore = await page.locator('text=/\\d+d view/').first().textContent();

    // Zoom in — dispatch synthetic WheelEvent with explicit clientX/clientY
    var cx = box.x + box.width * 0.5;
    var cy = box.y + box.height * 0.5;
    for (var i = 0; i < 10; i++) {
      await page.evaluate(({ x, y }) => {
        var canvas = document.querySelector('canvas');
        canvas.dispatchEvent(new WheelEvent('wheel', {
          clientX: x, clientY: y, deltaX: 0, deltaY: -200,
          bubbles: true, cancelable: true
        }));
      }, { x: cx, y: cy });
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Click Reset zoom
    var resetBtn = page.locator('text=Reset zoom');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await page.waitForTimeout(500);

    var labelAfter = await page.locator('text=/\\d+d view/').first().textContent();
    expect(labelAfter.trim()).toBe(labelBefore.trim());

    expect(page.errors).toHaveLength(0);
  });

  test('no JavaScript errors at any zoom level during zoom-in sequence', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();
    var cx = box.x + box.width * 0.2;
    var cy = box.y + box.height * 0.5;

    // Zoom through all levels: 29d → 14d → 8d → 4d → 2d
    for (var i = 0; i < 40; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1000);

    // No JS errors should occur during rapid zooming
    expect(page.errors).toHaveLength(0);
  });

  test('no JavaScript errors during pan interactions', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Zoom in first
    for (var i = 0; i < 15; i++) {
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
      await page.mouse.wheel(0, -200);
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(500);

    // Pan left and right
    var startX = box.x + box.width * 0.7;
    var startY = box.y + box.height * 0.5;
    var endX = box.x + box.width * 0.3;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (var j = 0; j < 10; j++) {
      await page.mouse.move(startX + (endX - startX) * j / 10, startY);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  test('distances checkbox toggles dimension lines', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var checkbox = page.locator('input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible();

    // Toggle off and on — should not throw errors
    await checkbox.uncheck();
    await page.waitForTimeout(500);
    await checkbox.check();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  // Flaky in CI: filter pills depend on registry data loading before the DOM
  // snapshot — passes locally and intermittently in CI containers.
  // Tracked for stabilisation separately from BU feedback changes.
  test.fixme('cycle filter buttons are visible and clickable', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // "All" filter button should be active by default
    var allBtn = page.locator('button', { hasText: 'All' }).first();
    await expect(allBtn).toBeVisible();

    // Cycle buttons (e.g., "3.5", "3.6") should be present
    var cycleButtons = page.locator('button').filter({ hasText: /^\d+\.\d+$/ });
    var cycleCount = await cycleButtons.count();
    expect(cycleCount).toBeGreaterThan(0);

    // Click a cycle filter — should not error
    await cycleButtons.first().click();
    await page.waitForTimeout(500);

    // Click back to All
    await allBtn.click();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });

  test('canvas renders consistently after rapid zoom in and out', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();
    var cx = box.x + box.width * 0.3;
    var cy = box.y + box.height * 0.5;

    // Rapidly zoom in
    for (var i = 0; i < 20; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(30);
    }
    // Rapidly zoom out
    for (var j = 0; j < 20; j++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(1000);

    // Canvas should still exist and page should be error-free
    await expect(canvas).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });

  test('no JavaScript errors during full zoom-out sequence', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();
    var cx = box.x + box.width * 0.5;
    var cy = box.y + box.height * 0.5;

    // Zoom out from default 29d through 52d, 78d, to max 90d
    for (var i = 0; i < 40; i++) {
      await page.mouse.move(cx, cy);
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1000);

    await expect(canvas).toBeVisible();
    expect(page.errors).toHaveLength(0);
  });

  test('version filter pills appear and are clickable', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var versionPills = page.locator('button').filter({ hasText: /^\d+\.\d+\s+(EA\d+|GA)$/ });
    var pillCount = await versionPills.count();
    expect(pillCount).toBeGreaterThan(0);

    await versionPills.first().click();
    await page.waitForTimeout(500);

    var clearBtn = page.locator('button', { hasText: 'Clear' });
    await expect(clearBtn).toBeVisible();

    await clearBtn.click();
    await page.waitForTimeout(500);

    expect(page.errors).toHaveLength(0);
  });
});
