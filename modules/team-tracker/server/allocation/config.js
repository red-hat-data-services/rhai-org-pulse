/**
 * Allocation storage configuration.
 * All allocation data lives under the allocation/ prefix within team-tracker module storage.
 */

const STORAGE_PREFIX = 'allocation/';

/**
 * Get a storage key under the allocation prefix.
 * @param {string} key - Relative storage key
 * @returns {string} Prefixed key
 */
function allocationKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

module.exports = {
  STORAGE_PREFIX,
  allocationKey
};
