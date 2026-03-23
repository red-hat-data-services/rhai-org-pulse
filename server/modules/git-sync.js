/**
 * Git sync engine for git-static modules.
 * Clones/pulls git repos and stores content in data/modules/<slug>/.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const modulesConfig = require('./config');

// Per-module sync locking
const syncingModules = new Set();

function isSyncing(slug) {
  return syncingModules.has(slug);
}

/**
 * Sanitize error messages to remove any token content.
 */
function sanitizeError(message, token) {
  if (!token || !message) return message || 'Unknown error';
  // Replace token with [REDACTED] in case it leaked into error output
  return message.split(token).join('[REDACTED]');
}

/**
 * Sync a single git-static module.
 * Clones or fetches+resets the repo.
 */
async function syncModule(storage, mod) {
  if (mod.type !== 'git-static') {
    return { status: 'skipped', message: 'Not a git-static module' };
  }

  if (!mod.gitUrl) {
    return { status: 'error', message: 'No gitUrl configured' };
  }

  if (!modulesConfig.isValidGitUrl(mod.gitUrl)) {
    return { status: 'error', message: 'Invalid git URL — must be HTTPS' };
  }

  if (syncingModules.has(mod.slug)) {
    return { status: 'conflict', message: 'Sync already in progress for this module' };
  }

  syncingModules.add(mod.slug);
  const startTime = Date.now();

  try {
    const dataDir = storage.DATA_DIR;
    const moduleDir = path.join(dataDir, 'modules', mod.slug);
    const branch = mod.gitBranch || 'main';

    // Ensure parent directory exists
    const modulesDir = path.join(dataDir, 'modules');
    if (!fs.existsSync(modulesDir)) {
      fs.mkdirSync(modulesDir, { recursive: true });
    }

    const gitDir = path.join(moduleDir, '.git');
    const isExisting = fs.existsSync(gitDir);

    // Build environment with GIT_ASKPASS for token auth
    const env = { ...process.env };
    let helperPath = null;

    if (mod.gitToken) {
      // Create a temporary GIT_ASKPASS helper script
      helperPath = path.join(os.tmpdir(), `git-askpass-${mod.slug}-${Date.now()}.sh`);
      fs.writeFileSync(helperPath, `#!/bin/sh\necho "${mod.gitToken}"\n`, { mode: 0o700 });
      env.GIT_ASKPASS = helperPath;
    }

    try {
      if (isExisting) {
        // Fetch and reset
        await execGit(['fetch', 'origin', branch], { cwd: moduleDir, env }, mod.gitToken);
        await execGit(['reset', '--hard', `origin/${branch}`], { cwd: moduleDir, env }, mod.gitToken);
      } else {
        // Clone
        await execGit(
          ['clone', '--depth', '1', '--branch', branch, mod.gitUrl, moduleDir],
          { env },
          mod.gitToken
        );
      }
    } finally {
      // Clean up helper script
      if (helperPath && fs.existsSync(helperPath)) {
        try { fs.unlinkSync(helperPath); } catch { /* ignore */ }
      }
    }

    const duration = Date.now() - startTime;
    modulesConfig.updateSyncStatus(storage, mod.slug, 'success', null);
    console.log(`[module-sync] ${mod.slug}: synced in ${duration}ms`);
    return { status: 'success', message: `Synced successfully`, duration };
  } catch (err) {
    const duration = Date.now() - startTime;
    const safeMessage = sanitizeError(err.message, mod.gitToken);
    modulesConfig.updateSyncStatus(storage, mod.slug, 'error', safeMessage);
    console.error(`[module-sync] ${mod.slug}: failed -`, safeMessage);
    return { status: 'error', message: safeMessage, duration };
  } finally {
    syncingModules.delete(mod.slug);
  }
}

/**
 * Execute a git command using execFile (no shell injection risk).
 */
function execGit(args, options, token) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { timeout: 120000, ...options }, (error, stdout, stderr) => {
      if (error) {
        const message = sanitizeError(
          error.message || stderr || 'git command failed',
          token
        );
        reject(new Error(message));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Sync all git-static modules sequentially.
 */
async function syncAllModules(storage) {
  const config = modulesConfig.loadModulesConfig(storage);
  if (!config || !config.modules) return { results: [] };

  const gitModules = config.modules.filter(m => m.type === 'git-static');
  const results = [];

  for (const mod of gitModules) {
    const result = await syncModule(storage, mod);
    results.push({ slug: mod.slug, ...result });
  }

  return { results };
}

/**
 * Schedule daily git sync for all modules.
 */
let dailyTimer = null;
function scheduleDaily(storage) {
  if (dailyTimer) return;
  const INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  dailyTimer = setInterval(async () => {
    console.log('[module-sync] Daily sync starting...');
    try {
      await syncAllModules(storage);
    } catch (err) {
      console.error('[module-sync] Daily sync error:', err.message);
    }
  }, INTERVAL);
  dailyTimer.unref();
  console.log('Module sync: daily schedule active');
}

/**
 * Get sync status overview.
 */
function getSyncStatus(storage) {
  const config = modulesConfig.loadModulesConfig(storage);
  if (!config || !config.modules) return { modules: [] };

  return {
    modules: config.modules
      .filter(m => m.type === 'git-static')
      .map(m => ({
        slug: m.slug,
        syncing: syncingModules.has(m.slug),
        lastSyncAt: m.lastSyncAt || null,
        lastSyncStatus: m.lastSyncStatus || null,
        lastSyncError: m.lastSyncError || null
      }))
  };
}

module.exports = {
  syncModule,
  syncAllModules,
  scheduleDaily,
  getSyncStatus,
  isSyncing,
  // Exported for testing
  _sanitizeError: sanitizeError,
  _execGit: execGit
};
