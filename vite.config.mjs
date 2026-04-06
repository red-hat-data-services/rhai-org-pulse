import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@modules': path.resolve(__dirname, 'modules')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/modules': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Only proxy requests for git-static module content (HTML, assets).
        // Let Vite serve source files from the modules/ directory (for import.meta.glob).
        bypass(req) {
          const accept = req.headers.accept || ''
          // Vite module requests have JS accept headers or ?import/?t= query strings
          if (accept.includes('application/javascript') ||
              req.url.includes('?import') ||
              req.url.includes('?t=') ||
              req.url.includes('.vue?') ||
              req.url.endsWith('.json') ||
              req.url.endsWith('.js') ||
              req.url.endsWith('.vue')) {
            return req.url
          }
        }
      }
    }
  }
})
