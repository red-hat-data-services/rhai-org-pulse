import { createViteConfig } from '@org-pulse/core/vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = createViteConfig();

const MIME = { '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.js': 'application/javascript' };

config.plugins.push({
  name: 'serve-test-dashboard',
  configureServer(server) {
    const root = path.resolve(__dirname, 'modules/system-health/test-dashboard');
    server.middlewares.use('/test-dashboard', (req, res, next) => {
      const reqPath = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(root, reqPath === '/' ? 'index.html' : reqPath);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next();
      res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      fs.createReadStream(file).pipe(res);
    });
  }
});

export default config;
