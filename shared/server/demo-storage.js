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

module.exports = {
  readFromStorage,
  writeToStorage,
  listStorageFiles,
  deleteStorageDirectory,
  deleteFromStorage,
  FIXTURES_DIR
};
