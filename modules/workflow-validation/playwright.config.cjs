const path = require('node:path')
const { defineConfig, devices } = require('@playwright/test')

const projectRoot = path.resolve(__dirname, '../..')

module.exports = defineConfig({
  testDir: './tests/integration',
  testMatch: '*.spec.js',
  outputDir: path.join(projectRoot, 'test-results/workflow-validation'),
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:5173', actionTimeout: 10_000 },
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    cwd: projectRoot,
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
})
