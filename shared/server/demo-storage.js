/**
 * Demo mode storage - reads from fixtures/ directory.
 * Write operations are no-ops (demo data is read-only).
 */

const fs = require('fs');
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

function isPathSafe(resolvedPath) {
  const resolvedFixturesDir = path.resolve(FIXTURES_DIR);
  return resolvedPath === resolvedFixturesDir || resolvedPath.startsWith(resolvedFixturesDir + path.sep);
}

/**
 * Read JSON from fixtures directory
 * @param {string} key - Path relative to fixtures/ (e.g., 'team-data/registry.json' or 'people/name.json')
 * @returns {object|null} Parsed JSON or null if not found
 */
function readFromStorage(key) {
  const filePath = path.resolve(FIXTURES_DIR, key);
  if (!isPathSafe(filePath)) {
    console.error(`[demo-storage] Blocked path traversal attempt: ${key}`);
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
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
  const dirPath = path.resolve(FIXTURES_DIR, dir);
  if (!isPathSafe(dirPath)) {
    console.error(`[demo-storage] Blocked path traversal attempt: ${dir}`);
    return [];
  }
  try {
    return fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * List subdirectories in a directory of fixtures
 * @param {string} dir - Subdirectory name (e.g., 'org-lens')
 * @returns {string[]} Array of directory names (without path)
 */
function listStorageDirectories(dir) {
  const dirPath = path.resolve(FIXTURES_DIR, dir);
  if (!isPathSafe(dirPath)) {
    console.error(`[demo-storage] Blocked path traversal attempt: ${dir}`);
    return [];
  }
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
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
  const filePath = path.resolve(FIXTURES_DIR, key);
  if (!isPathSafe(filePath)) {
    console.error(`[demo-storage] Blocked path traversal attempt: ${key}`);
    return null;
  }
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

module.exports = {
  readFromStorage,
  writeToStorage,
  writeToStorageAtomic,
  listStorageFiles,
  listStorageDirectories,
  deleteStorageDirectory,
  deleteFromStorage,
  getFileMtime,
  FIXTURES_DIR
};
