import { mergeConfig } from 'vite'
import { createViteConfig } from '@org-pulse/core/vite'
import navDiscovery from './build/vite-plugin-nav-discovery.js'

export default mergeConfig(createViteConfig(), {
  plugins: [navDiscovery()],
  optimizeDeps: {
    exclude: ['@org-pulse/core']
  }
})
