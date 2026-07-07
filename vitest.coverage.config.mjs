/**
 * Dedicated coverage config — runs all tests in a single flat config
 * because Vitest's `projects` feature does not support coverage reporting.
 *
 * Usage: npm run test:coverage
 */
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

let coreDir
try {
  coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
} catch {
  coreDir = import.meta.dirname
}

const sharedExclude = [
  '**/node_modules/**',
  '**/tests/integration/**',
  '**/tests/smoke/**',
  'playwright-report/**',
  'modules/team-tracker/**',
  'shared/**',
]

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@/': path.resolve(coreDir, 'src') + '/',
      '@shared': path.resolve(coreDir, 'shared'),
      '@modules': path.resolve(import.meta.dirname, 'modules'),
      '@platform': path.resolve(import.meta.dirname, 'platform'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    environmentMatchGlobs: [
      ['modules/*/server/**/*.{test,spec}.js', 'node'],
      ['modules/*/__tests__/server/**/*.{test,spec}.js', 'node'],
    ],
    include: ['**/*.{test,spec}.js'],
    exclude: [
      ...sharedExclude,
      'server/**',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html'],
      reportOnFailure: true,
      include: [
        'modules/**/server/**/*.js',
        'modules/**/client/**/*.{js,vue}',
        'platform/**/*.{js,vue}',
      ],
      exclude: [
        '**/*.{test,spec}.js',
        '**/__tests__/**',
        '**/fixtures/**',
      ],
    },
  },
})
