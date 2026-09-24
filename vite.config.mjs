import { createViteConfig } from '@org-pulse/core/vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = createViteConfig();

const MIME = { '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.js': 'application/javascript' };

// Test dashboard serving plugin - handles both development and production
config.plugins.push({
  name: 'serve-test-dashboard',
  
  // Development: Vite dev server middleware
  configureServer(server) {
    const root = path.resolve(__dirname, 'modules/system-health/test-dashboard');
    server.middlewares.use('/test-dashboard', (req, res, next) => {
      const reqPath = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(root, reqPath === '/' ? 'index.html' : reqPath);
      // Security: Use root + path.sep to prevent path traversal to sibling directories
      if (!file.startsWith(root + path.sep) && file !== root || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
      res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      fs.createReadStream(file).pipe(res);
    });
  },
  
  // Production: Copy test-dashboard to dist/ during build
  closeBundle() {
    const src = path.resolve(__dirname, 'modules/system-health/test-dashboard');
    const dest = path.resolve(__dirname, 'dist/test-dashboard');
    
    if (!fs.existsSync(src)) {
      console.log('[serve-test-dashboard] No test-dashboard source found, skipping copy');
      return;
    }
    
    // Recursively copy directory
    function copyDir(srcDir, destDir) {
      fs.mkdirSync(destDir, { recursive: true });
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    
    try {
      copyDir(src, dest);
      console.log('[serve-test-dashboard] Copied test-dashboard to dist/');
    } catch (copyErr) {
      console.error('[serve-test-dashboard] Failed to copy:', copyErr.message);
    }
  }
});

export default config;
