/**
 * Static file serving middleware for git-static modules.
 * Serves module content from data/modules/<slug>/<subdirectory>/.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const modulesConfig = require('./config');

// Cache express.static instances keyed by slug+subdirectory
const staticCache = new Map();

function getCacheKey(slug, subdirectory) {
  return `${slug}:${subdirectory || '/'}`;
}

/**
 * Invalidate cached static middleware for a module.
 */
function invalidateCache(slug) {
  for (const key of staticCache.keys()) {
    if (key.startsWith(`${slug}:`)) {
      staticCache.delete(key);
    }
  }
}

const PLACEHOLDER_HTML = `<!DOCTYPE html>
<html>
<head><title>Module Not Yet Synced</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0;">
  <div style="text-align: center;">
    <h2 style="color: #374151;">Module not yet synced</h2>
    <p style="color: #6b7280;">An admin needs to trigger a sync from the Settings page.</p>
  </div>
</body>
</html>`;

/**
 * Create Express middleware for serving module static content.
 * Mount at /modules - handles /modules/:slug/*
 */
function createModuleStaticMiddleware(storage) {
  const dataDir = storage.DATA_DIR;

  return function moduleStaticMiddleware(req, res, next) {
    // Parse slug from URL: /slug/path/to/file
    const parts = req.path.split('/').filter(Boolean);
    if (parts.length === 0) {
      return res.status(404).json({ error: 'Module slug required' });
    }

    const slug = parts[0];

    // Look up module config
    const mod = modulesConfig.getModule(storage, slug);
    if (!mod) {
      return res.status(404).json({ error: `Module "${slug}" not found` });
    }

    if (mod.type !== 'git-static') {
      return res.status(404).json({ error: 'Not a static module' });
    }

    // Determine content root
    const subdirectory = (mod.gitSubdirectory || '/').replace(/^\//, '').replace(/\/$/, '');
    const contentRoot = subdirectory
      ? path.join(dataDir, 'modules', slug, subdirectory)
      : path.join(dataDir, 'modules', slug);

    // Path traversal prevention
    const resolvedRoot = path.resolve(contentRoot);
    const expectedPrefix = path.resolve(path.join(dataDir, 'modules', slug));
    if (!resolvedRoot.startsWith(expectedPrefix)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if content exists
    if (!fs.existsSync(resolvedRoot)) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(PLACEHOLDER_HTML);
    }

    // Get or create cached express.static instance
    const cacheKey = getCacheKey(slug, subdirectory);
    let staticHandler = staticCache.get(cacheKey);
    if (!staticHandler) {
      staticHandler = express.static(resolvedRoot, {
        index: ['index.html'],
        extensions: ['html'],
        dotfiles: 'deny'
      });
      staticCache.set(cacheKey, staticHandler);
    }

    // Strip the slug prefix from the URL for the static handler
    const originalUrl = req.url;
    req.url = '/' + parts.slice(1).join('/') || '/';

    staticHandler(req, res, function(err) {
      req.url = originalUrl;
      if (err) return next(err);
      next();
    });
  };
}

module.exports = {
  createModuleStaticMiddleware,
  invalidateCache
};
