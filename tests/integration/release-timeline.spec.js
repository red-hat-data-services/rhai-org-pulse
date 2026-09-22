const { test, expect } = require('@playwright/test');
const { DEFAULT_PAGE_WAIT_TIME } = require('./constants');
const { setupErrorTracking, logCapturedErrors } = require('./helpers');
const { unexpectedDemoResourceErrors } = require('./execute-helpers');

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

  test('today marker pulse dot is visible on the timeline', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The "YOU ARE HERE" marker is a pulsing red dot overlay positioned by _todayPx
    var todayPulse = page.locator('.animate-ping');
    await expect(todayPulse).toBeVisible();

    // The solid red dot next to the ping animation
    var todayDot = page.locator('.bg-red-500, .dark\\:bg-red-400');
    await expect(todayDot.first()).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('today marker is reachable after panning right and back', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    // Confirm today marker is visible initially
    var todayPulse = page.locator('.animate-ping');
    await expect(todayPulse).toBeVisible();

    // Pan right (drag left) to move the view into the future
    var startX = box.x + box.width * 0.7;
    var endX = box.x + box.width * 0.1;
    var cy = box.y + box.height * 0.5;
    for (var i = 0; i < 3; i++) {
      await page.mouse.move(startX, cy);
      await page.mouse.down();
      for (var s = 0; s < 10; s++) {
        await page.mouse.move(startX + (endX - startX) * s / 10, cy);
        await page.waitForTimeout(20);
      }
      await page.mouse.move(endX, cy);
      await page.mouse.up();
      await page.waitForTimeout(200);
    }

    // Pan back left (drag right) to return toward today
    for (var j = 0; j < 4; j++) {
      await page.mouse.move(endX, cy);
      await page.mouse.down();
      for (var s2 = 0; s2 < 10; s2++) {
        await page.mouse.move(endX + (startX - endX) * s2 / 10, cy);
        await page.waitForTimeout(20);
      }
      await page.mouse.move(startX, cy);
      await page.mouse.up();
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(500);

    // Today marker must be reachable — it should be visible again
    await expect(todayPulse).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('can pan backward through at least 30 days of schedule history', async ({ page }) => {
    await page.goto('/#/releases/schedule?e2e=1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // The integration fixtures can all be historical relative to the runtime
    // clock. Include released versions so the timeline remains available and
    // its historical pan behavior can be exercised deterministically.
    var hideReleased = page.getByLabel('Hide released');
    if (await hideReleased.isChecked()) {
      await hideReleased.uncheck();
      await page.waitForTimeout(500);
    }

    var canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    var box = await canvas.boundingBox();
    var DAY_MS = 86400000;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var historyBoundary = today.getTime() - 30 * DAY_MS;

    var timelineBefore = await page.evaluate(() => window.__releaseTimeline);
    expect(timelineBefore).toBeTruthy();
    expect(timelineBefore.fullRange.min).toBeLessThanOrEqual(historyBoundary);
    expect(timelineBefore.range.min).toBeGreaterThan(historyBoundary);

    // Drag right repeatedly to move the visible schedule backward in time.
    var startX = box.x + box.width * 0.2;
    var endX = box.x + box.width * 0.8;
    var cy = box.y + box.height * 0.5;
    for (var i = 0; i < 5; i++) {
      await page.mouse.move(startX, cy);
      await page.mouse.down();
      await page.mouse.move(endX, cy, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(150);
    }

    await expect.poll(async () => {
      return page.evaluate(() => window.__releaseTimeline.range.min);
    }).toBeLessThanOrEqual(historyBoundary);
    await expect(page.getByText('30-day history')).toBeVisible();
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

  test('clicking a milestone card deep-links into the Execute page with its version', async ({ page }) => {
    // ?e2e=1 opts the timeline into exposing card hit-boxes on window (inert in
    // normal prod; the integration image is not a VITE_DEMO_MODE build).
    await page.goto('/#/releases/schedule?e2e=1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    var box = await canvas.boundingBox();

    // The component exposes card hit-boxes on window in demo mode (canvas-relative
    // centres). Pick the first card that resolves to a version AND a product so we
    // can assert the product is carried through to the Execute page.
    var card = await page.evaluate(() => {
      var tl = window.__releaseTimeline;
      if (!tl || !tl.cards) return null;
      return tl.cards.find(function (c) { return c.version && c.products && c.products.length; }) || null;
    });
    expect(card).not.toBeNull();

    // Click the card centre (canvas origin + canvas-relative centre).
    await page.mouse.click(box.x + card.cx, box.y + card.cy);
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var url = page.url();
    expect(url).toContain('#/releases/execute');
    // The demo Execute tracking config (feature-tracking-config.json) is kept in
    // sync with the Schedule timeline versions, so the card's version resolves to
    // a real pill and is preserved (not reconciled away).
    expect(url).toContain('version=' + encodeURIComponent(card.version));
    // Cards deep-link straight to the Kanban board.
    expect(url).toContain('view=board');
    expect(url).toContain('tab=board');
    // The card's product is carried through: the Execute page lands on the
    // single clicked-card product rather than defaulting to ALL products of the
    // version (which would be a comma-joined list). We assert on the URL rather
    // than card.products[0] because each product renders as its own card and the
    // canvas hit-test may resolve overlapping cards to a sibling product; the
    // exact single-product mapping is pinned by the unit tests.
    var match = /[?&]products=([^&]+)/.exec(url);
    expect(match).not.toBeNull();
    var selected = decodeURIComponent(match[1]).split(',').filter(Boolean);
    expect(selected).toHaveLength(1);

    // The carried product must be a real product of the clicked version.
    var versionsRes = await page.request.get('/api/modules/releases/execution/tracking/versions');
    expect(versionsRes.ok()).toBeTruthy();
    var versionsBody = await versionsRes.json();
    var row = (versionsBody.versions || []).find(function (v) { return v.version === card.version; });
    expect(row).toBeTruthy();
    expect(row.products).toContain(selected[0]);

    // Landing on the Execute page logs expected demo resource 401/403/404s.
    expect(unexpectedDemoResourceErrors(page)).toHaveLength(0);
  });

  test('dragging over a milestone card pans instead of navigating', async ({ page }) => {
    await page.goto('/#/releases/schedule?e2e=1');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    var canvas = page.locator('canvas');
    var box = await canvas.boundingBox();

    var card = await page.evaluate(() => {
      var tl = window.__releaseTimeline;
      if (!tl || !tl.cards) return null;
      return tl.cards.find(function (c) { return c.version; }) || null;
    });
    expect(card).not.toBeNull();

    // Press on the card and drag well past the 4px threshold, then release.
    var startX = box.x + card.cx;
    var startY = box.y + card.cy;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (var s = 1; s <= 10; s++) {
      await page.mouse.move(startX - s * 8, startY);
      await page.waitForTimeout(15);
    }
    await page.mouse.up();
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // A drag must not navigate to the Execute page.
    expect(page.url()).toContain('#/releases/schedule');
    expect(page.url()).not.toContain('#/releases/execute');

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

  // Auto-fit: selecting a version whose milestones all sit off-screen — a released
  // version to the LEFT of "YOU ARE HERE", or a far-future version to the RIGHT —
  // shifts the timeline window so its cards become visible. The window shift sets a
  // zoom override, which surfaces "Reset zoom". Version pills render most-recent-first,
  // so the LAST pill is the oldest (released, milestones well before the default
  // today-anchored window) and the FIRST pill is the newest (in the fixtures an
  // upcoming version whose milestones fall after the default window).
  test('selecting a released version auto-fits the timeline into view', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Default view is not zoomed → no Reset zoom button yet.
    var resetBtn = page.locator('text=Reset zoom');
    await expect(resetBtn).toHaveCount(0);

    var versionPills = page.locator('button').filter({ hasText: /^\d+\.\d+\s+(EA\d+|GA)$/ });
    var pillCount = await versionPills.count();
    expect(pillCount).toBeGreaterThan(0);

    // Oldest version pill = released, milestones off-screen → should trigger a fit.
    await versionPills.nth(pillCount - 1).click();
    await page.waitForTimeout(800);

    // The auto-fit set a zoom window, so the reset control appears.
    await expect(resetBtn).toBeVisible();

    // The "YOU ARE HERE" marker must remain in frame after the fit.
    await expect(page.locator('.animate-ping')).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });

  test('selecting an upcoming version auto-fits the timeline into view', async ({ page }) => {
    await page.goto('/#/releases/schedule');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(DEFAULT_PAGE_WAIT_TIME);

    // Default view is not zoomed → no Reset zoom button yet.
    var resetBtn = page.locator('text=Reset zoom');
    await expect(resetBtn).toHaveCount(0);

    var versionPills = page.locator('button').filter({ hasText: /^\d+\.\d+\s+(EA\d+|GA)$/ });
    var pillCount = await versionPills.count();
    expect(pillCount).toBeGreaterThan(0);

    // Newest version pill = upcoming in the fixtures, with milestones after the default
    // window (off-screen to the right) → the timeline shifts forward to bring them in.
    await versionPills.first().click();
    await page.waitForTimeout(800);

    // The auto-fit set a zoom window, so the reset control appears.
    await expect(resetBtn).toBeVisible();

    // The "YOU ARE HERE" marker must remain in frame after the fit.
    await expect(page.locator('.animate-ping')).toBeVisible();

    expect(page.errors).toHaveLength(0);
  });
});
