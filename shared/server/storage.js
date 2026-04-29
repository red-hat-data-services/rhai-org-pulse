/**
 * Local file storage - drop-in replacement for S3 in local development.
 * Reads/writes JSON files to a local data/ directory.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Verify that a resolved path stays within DATA_DIR to prevent path traversal.
 * @param {string} resolvedPath - The fully resolved path to check
 * @returns {boolean} true if safe, false if path escapes DATA_DIR
 */
function isPathSafe(resolvedPath) {
  const resolvedDataDir = path.resolve(DATA_DIR);
  return resolvedPath === resolvedDataDir || resolvedPath.startsWith(resolvedDataDir + path.sep);
}

/**
 * Ensure the data directory and any subdirectories exist
 */
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read JSON from local file
 * @param {string} key - S3-style key (e.g., 'boards.json' or 'sprints/123.json')
 * @returns {object|null} Parsed JSON or null if not found
 */
function readFromStorage(key) {
  const filePath = path.resolve(DATA_DIR, key);
  if (!isPathSafe(filePath)) {
    console.error(`[storage] Blocked path traversal attempt: ${key}`);
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
 * Write JSON to local file
 * @param {string} key - S3-style key
 * @param {object} data - Data to write
 */
function writeToStorage(key, data) {
  const filePath = path.resolve(DATA_DIR, key);
  if (!isPathSafe(filePath)) {
    console.error(`[storage] Blocked path traversal attempt: ${key}`);
    return;
  }
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Wrote ${key} to local storage`);
}

/**
 * List JSON files in a subdirectory of storage
 * @param {string} dir - Subdirectory name (e.g., 'people')
 * @returns {string[]} Array of filenames (without path)
 */
function listStorageFiles(dir) {
  const dirPath = path.resolve(DATA_DIR, dir);
  if (!isPathSafe(dirPath)) {
    console.error(`[storage] Blocked path traversal attempt: ${dir}`);
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
 * Recursively delete a subdirectory of storage
 * @param {string} dir - Subdirectory name (e.g., 'snapshots')
 * @returns {{ deleted: number }} Count of JSON files that were in the directory
 */
function deleteStorageDirectory(dir) {
  const dirPath = path.resolve(DATA_DIR, dir);
  if (!isPathSafe(dirPath)) {
    console.error(`[storage] Blocked path traversal attempt: ${dir}`);
    return { deleted: 0 };
  }
  let deleted = 0;
  try {
    // Count files before deletion
    const countFiles = (p) => {
      const entries = fs.readdirSync(p, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) countFiles(path.join(p, entry.name));
        else if (entry.name.endsWith('.json')) deleted++;
      }
    };
    countFiles(dirPath);
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Deleted storage directory ${dir} (${deleted} files)`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { deleted: 0 };
    }
    throw error;
  }
  return { deleted };
}

/**
 * Delete a single file from storage
 * @param {string} key - S3-style key (e.g., 'release-planning/candidates-cache-3.5.json')
 */
function deleteFromStorage(key) {
  const filePath = path.resolve(DATA_DIR, key);
  if (!isPathSafe(filePath)) {
    console.error(`[storage] Blocked path traversal attempt: ${key}`);
    return;
  }
  try {
    fs.unlinkSync(filePath);
    console.log(`Deleted ${key} from local storage`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist — nothing to delete
      return;
    }
    throw error;
  }
}

module.exports = {
  readFromStorage,
  writeToStorage,
  listStorageFiles,
  deleteStorageDirectory,
  deleteFromStorage,
  DATA_DIR
};
