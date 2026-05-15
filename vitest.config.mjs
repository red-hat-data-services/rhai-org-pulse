import { configDefaults, defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@modules': path.resolve(__dirname, 'modules')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['server/**', 'node'],
      ['modules/*/server/**', 'node'],
      ['modules/*/__tests__/server/**', 'node'],
    ],
    exclude: [
      ...configDefaults.exclude,
      '**/tests/smoke/**',        // Exclude Playwright smoke tests
      '**/tests/integration/**',  // Exclude Playwright integration tests
      'playwright-report/**',     // Exclude any Playwright output folders
    ],
  },
})
