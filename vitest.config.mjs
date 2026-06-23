import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

const sharedExclude = [
  '**/node_modules/**',
  '**/tests/smoke/**',
  '**/tests/integration/**',
  'playwright-report/**',
  'docs/module-template/**',
]

const sharedConfig = {
  plugins: [vue()],
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, 'src') + '/',
      '@shared': path.resolve(__dirname, 'shared'),
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
            'server/**/*.{test,spec}.js',
            'shared/server/**/*.{test,spec}.js',
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
          include: ['**/*.{test,spec}.js'],
          exclude: [
            ...sharedExclude,
            'server/**',
            'shared/server/**',
            'modules/*/server/**',
            'modules/*/__tests__/server/**',
          ],
        },
      },
    ],
  },
})
