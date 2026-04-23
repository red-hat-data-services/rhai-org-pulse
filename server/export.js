/**
 * Test data export orchestrator.
 *
 * Reads roster, builds PII mapping, discovers modules with export hooks,
 * calls hooks via addFile callback, handles platform-level files,
 * and streams a tarball response.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const tar = require('tar');
const { buildMapping } = require('../shared/server/anonymize');

let _exporting = false;

/**
 * Handle GET /api/export/test-data
 */
async function handleExport(req, res, storageModule, builtInModules) {
  if (_exporting) {
    return res.status(429).json({ error: 'Export already in progress' });
  }

  _exporting = true;
  const errors = [];
  let tmpDir = null;

  try {
    const { readFromStorage } = storageModule;

    // Build PII mapping from roster
    const { readRosterFull } = require('../shared/server/roster');
    const roster = readRosterFull(storageModule);
    const mapping = buildMapping(roster);

    // Create temp directory structure
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-export-'));
    const dataDir = path.join(tmpDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    function addFile(filePath, data) {
      const fullPath = path.join(dataDir, filePath);
      if (!fullPath.startsWith(dataDir)) {
        throw new Error('Path traversal detected: ' + filePath);
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    }

    // Discover and call module export hooks
    for (const mod of builtInModules) {
      if (!mod.export || !mod.export.customHandler) continue;

      const exportPath = path.join(mod._dir, 'server', 'export.js');
      try {
        const exportHook = require(exportPath);
        await exportHook(addFile, storageModule, mapping);
      } catch (err) {
        console.error(`[export] Module "${mod.slug}" export hook failed:`, err.message);
        errors.push({ module: mod.slug, error: err.message });
      }
    }

    // Platform-level files (orchestrator handles directly)
    // allowlist.json - anonymize emails
    const allowlist = readFromStorage('allowlist.json');
    if (allowlist) {
      const anonymizedAllowlist = { ...allowlist };
      if (Array.isArray(anonymizedAllowlist.emails)) {
        anonymizedAllowlist.emails = anonymizedAllowlist.emails.map((email, i) =>
          `user${i + 1}@example.com`
        );
      }
      addFile('allowlist.json', anonymizedAllowlist);
    }

    // modules-state.json - include as-is
    const modulesState = readFromStorage('modules-state.json');
    if (modulesState) {
      addFile('modules-state.json', modulesState);
    }

    // last-refreshed.json - include as-is (may also be handled by TT hook, check for dup)
    const lastRefreshedPath = path.join(dataDir, 'last-refreshed.json');
    if (!fs.existsSync(lastRefreshedPath)) {
      const lastRefreshed = readFromStorage('last-refreshed.json');
      if (lastRefreshed) {
        addFile('last-refreshed.json', lastRefreshed);
      }
    }

    // Include error manifest if any errors
    if (errors.length > 0) {
      addFile('_export-errors.json', { errors, exportedAt: new Date().toISOString() });
    }

    // Stream tarball
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="org-pulse-test-data.tgz"');
    res.setHeader('Content-Encoding', 'identity');

    await tar.create(
      {
        gzip: true,
        cwd: tmpDir,
        portable: true,
      },
      ['data']
    ).pipe(res);

    await new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
    });
  } catch (err) {
    console.error('[export] Export failed:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Export failed: ' + err.message });
    }
  } finally {
    _exporting = false;
    // Clean up temp directory
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // best effort cleanup
      }
    }
  }
}

module.exports = { handleExport };
