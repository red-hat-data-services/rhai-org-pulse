/**
 * Backup-before-destructive-write logic for config.json.
 *
 * Creates timestamped backups before destructive operations (delete Big Rock,
 * delete release, replace-mode import). Retains the 10 most recent backups.
 */

const BACKUP_PREFIX = 'release-planning/config-backup-'
const MAX_BACKUPS = 10

function backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage) {
  const config = readFromStorage('release-planning/config.json')
  if (!config) return

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  writeToStorage(`${BACKUP_PREFIX}${ts}.json`, config)

  pruneOldBackups(listStorageFiles, deleteFromStorage)
}

function pruneOldBackups(listStorageFiles, deleteFromStorage) {
  if (!listStorageFiles || !deleteFromStorage) return

  try {
    const files = listStorageFiles('release-planning')
    const backupFiles = files
      .filter(function(f) { return f.startsWith('config-backup-') && f.endsWith('.json') })
      .sort()

    if (backupFiles.length > MAX_BACKUPS) {
      const toDelete = backupFiles.slice(0, backupFiles.length - MAX_BACKUPS)
      for (const file of toDelete) {
        deleteFromStorage(`release-planning/${file}`)
      }
    }
  } catch (err) {
    console.error('[release-planning] Failed to prune old backups:', err.message)
  }
}

module.exports = { backupConfig }
