import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

let coreDir
try {
  coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'))
} catch {
  coreDir = __dirname
}

const sharedExclude = [
  '**/node_modules/**',
  '**/tests/integration/**',
  '**/tests/smoke/**',
  'playwright-report/**',
  'modules/team-tracker/**',
  'shared/**',
]

const sharedConfig = {
  plugins: [vue()],
  resolve: {
    alias: {
      '@/': path.resolve(coreDir, 'src') + '/',
      '@shared': path.resolve(coreDir, 'shared'),
      '@modules': path.resolve(__dirname, 'modules'),
      '@platform': path.resolve(__dirname, 'platform')
    }
  },
}

export default defineConfig({
  test: {
    globals: true,
    exclude: sharedExclude,
    projects: [
      {
        ...sharedConfig,
        test: {
          name: 'server',
          globals: true,
          environment: 'node',
          include: [
            'modules/*/server/**/*.{test,spec}.js',
            'modules/*/__tests__/server/**/*.{test,spec}.js',
          ],
        },
      },
      {
        ...sharedConfig,
        test: {
          name: 'client',
          globals: true,
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.js'],
          include: ['**/*.{test,spec}.js'],
          exclude: [
            ...sharedExclude,
            'server/**',
            'modules/*/server/**',
            'modules/*/__tests__/server/**',
          ],
        },
      },
    ],
  },
})
