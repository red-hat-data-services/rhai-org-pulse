/**
 * Roster sync barrel export.
 * Re-exports consolidated sync as the main sync pipeline.
 */

const { runConsolidatedSync, isSyncInProgress } = require('./consolidated-sync');

module.exports = {
  runSync: runConsolidatedSync,
  isSyncInProgress
};
