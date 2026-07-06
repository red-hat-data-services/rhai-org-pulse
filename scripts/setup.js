#!/usr/bin/env node

/**
 * Workspace setup for AI Eng Org Pulse.
 *
 * Runs the core sync-core.js script (symlinks core modules, copies index.html),
 * then creates an additional symlink for shared/ so that module server code
 * can use relative require() paths to shared/server/*.
 */

const fs = require('fs');
const path = require('path');

// Run core's sync-core.js first
require('@org-pulse/core/scripts/sync-core.js');

// Symlink shared/ from core into project root
// Module server code uses relative paths like require('../../../../shared/server/jira')
// which need shared/ at the project root.
let coreDir;
try {
  coreDir = path.dirname(require.resolve('@org-pulse/core/package.json'));
} catch {
  process.exit(0);
}

const target = path.join(coreDir, 'shared');
const link = path.join(process.cwd(), 'shared');

if (!fs.existsSync(link)) {
  fs.symlinkSync(target, link, 'dir');
  console.log('[ai-eng] Symlinked shared/');
} else {
  // Check if it's already a correct symlink
  try {
    const existing = fs.readlinkSync(link);
    if (path.resolve(path.dirname(link), existing) !== target) {
      console.log('[ai-eng] shared/ exists but points elsewhere — skipping');
    }
  } catch {
    // Not a symlink — local directory exists, skip
  }
}
