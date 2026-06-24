/**
 * Demo mode storage - reads from fixtures/ directory.
 * Write operations are no-ops (demo data is read-only).
 */

const fs = require('fs');
const path = require('path');

let FIXTURES_DIRS = [path.join(__dirname, '..', '..', 'fixtures')];

/**
 * Initialize demo storage with custom fixture directories.
 * Directories are searched in order; first match wins.
 * @param {{ fixturesDirs: string[] }} options
 */
function initDemoStorage({ fixturesDirs }) {
  FIXTURES_DIRS = fixturesDirs.map(d => path.resolve(d));
}

function isPathSafeForDir(resolvedPath, baseDir) {
  const resolvedBase = path.resolve(baseDir);
  return resolvedPath === resolvedBase || resolvedPath.startsWith(resolvedBase + path.sep);
}

/**
 * Find a file across all fixture directories. Returns the first match.
 * @param {string} key - Relative path
 * @returns {{ filePath: string, baseDir: string } | null}
 */
function findInFixtures(key) {
  for (const dir of FIXTURES_DIRS) {
    const filePath = path.resolve(dir, key);
    if (!isPathSafeForDir(filePath, dir)) continue;
    if (fs.existsSync(filePath)) {
      return { filePath, baseDir: dir };
    }
  }
  return null;
}

/**
 * Read JSON from fixtures directory
 * @param {string} key - Path relative to fixtures/ (e.g., 'team-data/registry.json' or 'people/name.json')
 * @returns {object|null} Parsed JSON or null if not found
 */
function readFromStorage(key) {
  const found = findInFixtures(key);
  if (!found) return null;
  try {
    const content = fs.readFileSync(found.filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * No-op write for demo mode (fixtures are read-only)
 * @param {string} key - Would-be path
 * @param {object} _data - Data that would be written
 */
function writeToStorage(key, _data) {
  console.log(`[Demo Mode] Write ignored: ${key}`);
}

/**
 * No-op atomic write for demo mode (fixtures are read-only)
 * @param {string} key - Would-be path
 * @param {object} _data - Data that would be written
 */
function writeToStorageAtomic(key, _data) {
  console.log(`[Demo Mode] Write ignored: ${key}`);
}

/**
 * List JSON files in a subdirectory of fixtures
 * @param {string} dir - Subdirectory name (e.g., 'people')
 * @returns {string[]} Array of filenames (without path)
 */
function listStorageFiles(dir) {
  const seen = new Set();
  const results = [];
  for (const baseDir of FIXTURES_DIRS) {
    const dirPath = path.resolve(baseDir, dir);
    if (!isPathSafeForDir(dirPath, baseDir)) continue;
    try {
      for (const f of fs.readdirSync(dirPath)) {
        if (f.endsWith('.json') && !seen.has(f)) {
          seen.add(f);
          results.push(f);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return results;
}

/**
 * No-op delete for demo mode (fixtures are read-only)
 * @param {string} dir - Would-be directory to delete
 * @returns {{ deleted: number }}
 */
function deleteStorageDirectory(dir) {
  console.log(`[Demo Mode] Delete ignored: ${dir}`);
  return { deleted: 0 };
}

/**
 * No-op single file delete for demo mode (fixtures are read-only)
 * @param {string} key - Would-be file to delete
 */
function deleteFromStorage(key) {
  console.log(`[Demo Mode] Delete ignored: ${key}`);
}

/**
 * Get the modification time of a fixture file without reading it.
 * In demo mode, mtimes are static — polling detects no changes (by design).
 * @param {string} key - S3-style key
 * @returns {number|null} mtime in milliseconds, or null if not found
 */
function getFileMtime(key) {
  const found = findInFixtures(key);
  if (!found) return null;
  try {
    return fs.statSync(found.filePath).mtimeMs;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

module.exports = {
  initDemoStorage,
  readFromStorage,
  writeToStorage,
  writeToStorageAtomic,
  listStorageFiles,
  deleteStorageDirectory,
  deleteFromStorage,
  getFileMtime,
  get FIXTURES_DIR() { return FIXTURES_DIRS[0]; }
};
