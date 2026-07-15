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

const coreShared = path.join(coreDir, 'shared');
const localShared = path.join(process.cwd(), 'shared');

// Ensure shared/ directory exists (it may contain local data files)
if (!fs.existsSync(localShared)) {
  fs.mkdirSync(localShared);
}

// Symlink shared/server and shared/client individually so that module
// server code using relative require() paths (e.g. ../../../../shared/server/jira)
// resolves correctly. We can't symlink shared/ itself because it may
// contain local data files (shared/data/).
for (const sub of ['server', 'client']) {
  const target = path.join(coreShared, sub);
  const link = path.join(localShared, sub);

  try {
    const existing = fs.readlinkSync(link);
    if (path.resolve(path.dirname(link), existing) === target) continue;
    fs.unlinkSync(link);
  } catch {
    // Not a symlink or doesn't exist — proceed
    if (fs.existsSync(link)) continue; // Real directory, don't touch
  }

  fs.symlinkSync(target, link, 'dir');
  console.log(`[ai-eng] Symlinked shared/${sub}`);
}
