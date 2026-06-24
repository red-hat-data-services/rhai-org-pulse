#!/usr/bin/env node

/**
 * Workspace merge script for @org-pulse/core consumers.
 *
 * Creates symlinks from the consumer's project root into the core npm package,
 * producing a flat directory structure that import.meta.glob can traverse.
 *
 * Usage:
 *   node node_modules/@org-pulse/core/scripts/sync-core.js
 *   Or via package.json: "setup": "node node_modules/@org-pulse/core/scripts/sync-core.js"
 */

const fs = require('fs');
const path = require('path');

// Defensive: exit gracefully if core package isn't installed yet
// (npm ci runs postinstall before all deps may be resolved)
let coreDir;
try {
  coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'));
} catch {
  console.warn('[@org-pulse/core] Not installed yet — skipping workspace sync.');
  process.exit(0);
}

const projectRoot = process.cwd();

// Symlink core modules into consumer's modules/ directory
// e.g., modules/team-tracker -> node_modules/@org-pulse/core/modules/team-tracker
const coreModulesDir = path.join(coreDir, 'modules');
const localModulesDir = path.join(projectRoot, 'modules');

if (fs.existsSync(coreModulesDir)) {
  if (!fs.existsSync(localModulesDir)) {
    fs.mkdirSync(localModulesDir, { recursive: true });
  }

  for (const mod of fs.readdirSync(coreModulesDir)) {
    const target = path.join(coreModulesDir, mod);
    const link = path.join(localModulesDir, mod);

    // Skip if not a directory
    try {
      if (!fs.statSync(target).isDirectory()) continue;
    } catch { continue; }

    if (fs.existsSync(link)) {
      // Check if it's already a symlink pointing to the right place
      try {
        const existing = fs.readlinkSync(link);
        if (path.resolve(path.dirname(link), existing) === target) {
          continue; // Already correct
        }
      } catch {
        // Not a symlink — consumer has their own directory, skip
        continue;
      }
    }

    fs.symlinkSync(target, link, 'dir');
    console.log(`[@org-pulse/core] Symlinked modules/${mod}`);
  }
}

// Copy index.html to project root.
// Overwrite if the existing copy matches a previous core version (stamp-based).
// If the consumer has customized it (stamp missing), leave it alone.
const STAMP = '<!-- @org-pulse/core -->';
const coreHtml = path.join(coreDir, 'index.html');
const localHtml = path.join(projectRoot, 'index.html');

if (fs.existsSync(coreHtml)) {
  if (!fs.existsSync(localHtml)) {
    fs.copyFileSync(coreHtml, localHtml);
    console.log('[@org-pulse/core] Copied index.html');
  } else {
    const content = fs.readFileSync(localHtml, 'utf8');
    if (content.includes(STAMP)) {
      // Previous core copy — safe to overwrite with new version
      fs.copyFileSync(coreHtml, localHtml);
      console.log('[@org-pulse/core] Updated index.html (stamp-matched)');
    }
    // else: consumer-customized — leave it alone
  }
}

console.log('[@org-pulse/core] Workspace sync complete.');
