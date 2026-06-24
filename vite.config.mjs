import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Create a Vite config for Org Pulse.
 *
 * Dual-root resolution model:
 * - @/ and @shared resolve from coreDir (this package)
 * - @modules and @platform resolve from projectRoot (consumer)
 * - import.meta.glob absolute paths resolve from root (projectRoot)
 *
 * @param {{ root?: string, aliases?: Record<string, string> }} options
 */
export function createViteConfig(options = {}) {
  const coreDir = __dirname
  const projectRoot = options.root || coreDir

  return defineConfig({
    root: projectRoot,
    plugins: [
      vue()
    ],
    resolve: {
      alias: {
        '@/': path.resolve(coreDir, 'src') + '/',
        '@shared': path.resolve(coreDir, 'shared'),
        '@modules': path.resolve(projectRoot, 'modules'),
        '@platform': path.resolve(projectRoot, 'platform'),
        ...options.aliases
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
}

// Default export for standalone use (core repo development)
export default createViteConfig()
