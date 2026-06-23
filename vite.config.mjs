import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, 'src') + '/',
      '@shared': path.resolve(__dirname, 'shared'),
      '@modules': path.resolve(__dirname, 'modules'),
      '@platform': path.resolve(__dirname, 'platform')
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
          const pathOnly = (req.url || '').split('?')[0]
          // Static HTML under modules/ (e.g. quality reports imported with ?url) must be served by Vite, not the API.
          if (/\.html$/i.test(pathOnly)) {
            return req.url
          }
          const accept = req.headers.accept || ''
          // Vite module requests have JS accept headers or ?import/?t= query strings
          if (accept.includes('application/javascript') ||
              req.url.includes('?import') ||
              req.url.includes('?t=') ||
              req.url.includes('.vue?') ||
              req.url.endsWith('.json') ||
              req.url.endsWith('.js') ||
              req.url.endsWith('.css') ||
              req.url.endsWith('.vue')) {
            return req.url
          }
        }
      }
    }
  }
})
