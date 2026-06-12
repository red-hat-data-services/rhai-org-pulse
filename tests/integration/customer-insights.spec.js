const { test, expect } = require('@playwright/test')

test.describe('@customer-insights Customer Insights Module', () => {
  test('module is visible and clickable in sidebar', async ({ page }) => {
    await page.goto('/')

    // Wait for sidebar to load
    await page.waitForSelector('[data-testid="sidebar"]', { timeout: 10000 })

    // Find Customer Insights link
    const link = page.locator('a:has-text("Customer Insights")')
    await expect(link).toBeVisible()

    // Click and verify navigation
    await link.click()
    await expect(page).toHaveURL(/#\/customer-insights/)
  })

  test('Kanban view loads correctly', async ({ page }) => {
    await page.goto('/#/customer-insights/kanban')

    // Wait for view to load
    await page.waitForLoadState('networkidle')

    // Check for Kanban board presence (either board or empty state)
    const hasBoard = await page.locator('[data-testid="kanban-board"]').isVisible().catch(() => false)
    const hasEmptyState = await page.locator('text=/no.*data|coming soon|get started/i').isVisible().catch(() => false)

    expect(hasBoard || hasEmptyState).toBeTruthy()
  })

  test('Table view loads correctly', async ({ page }) => {
    await page.goto('/#/customer-insights/table')

    await page.waitForLoadState('networkidle')

    // Check for table or empty state
    const hasTable = await page.locator('table').isVisible().catch(() => false)
    const hasEmptyState = await page.locator('text=/no.*data|coming soon|get started/i').isVisible().catch(() => false)

    expect(hasTable || hasEmptyState).toBeTruthy()
  })

  test('Dashboard view loads correctly', async ({ page }) => {
    await page.goto('/#/customer-insights/dashboard')

    await page.waitForLoadState('networkidle')

    // Check for dashboard content or empty state
    const hasDashboard = await page.locator('[data-testid="dashboard"]').isVisible().catch(() => false)
    const hasCharts = await page.locator('canvas').count() > 0
    const hasEmptyState = await page.locator('text=/no.*data|coming soon|get started/i').isVisible().catch(() => false)

    expect(hasDashboard || hasCharts || hasEmptyState).toBeTruthy()
  })

  test('Import view loads with tabs', async ({ page }) => {
    await page.goto('/#/customer-insights/import')

    await page.waitForLoadState('networkidle')

    // Check for import tabs
    const csvTab = page.locator('button:has-text("CSV Upload")')
    const transcriptTab = page.locator('button:has-text("Transcript")')
    const driveTab = page.locator('button:has-text("Google Drive")')

    await expect(csvTab).toBeVisible()
    await expect(transcriptTab).toBeVisible()
    await expect(driveTab).toBeVisible()
  })

  test('Insights view loads correctly', async ({ page }) => {
    await page.goto('/#/customer-insights/insights')

    await page.waitForLoadState('networkidle')

    // Check for insights content or empty state
    const hasInsights = await page.locator('[data-testid="insights-list"]').isVisible().catch(() => false)
    const hasEmptyState = await page.locator('text=/no.*data|coming soon|pipeline/i').isVisible().catch(() => false)

    expect(hasInsights || hasEmptyState).toBeTruthy()
  })

  test('Roadmap view loads correctly', async ({ page }) => {
    await page.goto('/#/customer-insights/roadmap')

    await page.waitForLoadState('networkidle')

    // Check for roadmap content or empty state
    const hasRoadmap = await page.locator('[data-testid="roadmap-grid"]').isVisible().catch(() => false)
    const hasCards = await page.locator('[data-testid="roadmap-card"]').count() > 0
    const hasEmptyState = await page.locator('text=/no.*data|coming soon/i').isVisible().catch(() => false)

    expect(hasRoadmap || hasCards || hasEmptyState).toBeTruthy()
  })

  test('RFE Creator view loads correctly', async ({ page }) => {
    await page.goto('/#/customer-insights/rfe-creator')

    await page.waitForLoadState('networkidle')

    // Check for form elements
    const titleInput = page.locator('input[placeholder*="title" i], input[name="title"]')
    const descriptionInput = page.locator('textarea[placeholder*="description" i], textarea[name="description"]')

    // At least one form element should be visible
    const hasTitleInput = await titleInput.isVisible().catch(() => false)
    const hasDescriptionInput = await descriptionInput.isVisible().catch(() => false)

    expect(hasTitleInput || hasDescriptionInput).toBeTruthy()
  })

  test('API endpoints return data in demo mode', async ({ page }) => {
    // Intercept API calls
    const apiCalls = []

    page.on('response', response => {
      if (response.url().includes('/api/modules/customer-insights/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status()
        })
      }
    })

    // Navigate to dashboard to trigger API calls
    await page.goto('/#/customer-insights/dashboard')
    await page.waitForLoadState('networkidle')

    // Wait a bit for async API calls
    await page.waitForTimeout(2000)

    // Check that at least one API call succeeded
    const successfulCalls = apiCalls.filter(call => call.status >= 200 && call.status < 300)

    // In demo mode, we should get successful responses (even if empty data)
    expect(successfulCalls.length).toBeGreaterThan(0)
  })

  test('Navigation between views works', async ({ page }) => {
    await page.goto('/#/customer-insights/kanban')
    await page.waitForLoadState('networkidle')

    // Navigate to table view
    const tableLink = page.locator('a:has-text("Table"), button:has-text("Table")')
    if (await tableLink.isVisible().catch(() => false)) {
      await tableLink.click()
      await expect(page).toHaveURL(/#\/customer-insights\/table/)
    }

    // Navigate to dashboard
    const dashboardLink = page.locator('a:has-text("Dashboard"), button:has-text("Dashboard")')
    if (await dashboardLink.isVisible().catch(() => false)) {
      await dashboardLink.click()
      await expect(page).toHaveURL(/#\/customer-insights\/dashboard/)
    }
  })
})
