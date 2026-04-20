/**
 * Audit log for team structure management.
 * Append-only JSON storage, capped at maxEntries.
 */

const crypto = require('crypto');

const AUDIT_LOG_KEY = 'audit-log.json';
const DEFAULT_MAX_ENTRIES = 10000;

function generateId() {
  return 'evt_' + crypto.randomBytes(4).toString('hex');
}

/**
 * Append an audit entry.
 * @param {{ readFromStorage: Function, writeToStorage: Function }} storage
 * @param {{ action: string, actor: string, entityType: string, entityId: string, entityLabel?: string, field?: string, oldValue?: *, newValue?: *, detail?: string }} entry
 */
function appendAuditEntry(storage, entry) {
  const log = storage.readFromStorage(AUDIT_LOG_KEY) || { entries: [], maxEntries: DEFAULT_MAX_ENTRIES };
  const maxEntries = log.maxEntries || DEFAULT_MAX_ENTRIES;

  const fullEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel || null,
    field: entry.field || null,
    oldValue: entry.oldValue !== undefined ? entry.oldValue : null,
    newValue: entry.newValue !== undefined ? entry.newValue : null,
    detail: entry.detail || null
  };

  log.entries.unshift(fullEntry);

  // Enforce cap
  if (log.entries.length > maxEntries) {
    log.entries = log.entries.slice(0, maxEntries);
  }

  storage.writeToStorage(AUDIT_LOG_KEY, log);
  return fullEntry;
}

/**
 * Query audit log with filters and pagination.
 * @param {{ readFromStorage: Function }} storage
 * @param {{ from?: string, to?: string, action?: string, actor?: string, entityId?: string, limit?: number, offset?: number }} filters
 * @returns {{ entries: object[], total: number }}
 */
function queryAuditLog(storage, filters = {}) {
  const log = storage.readFromStorage(AUDIT_LOG_KEY) || { entries: [] };
  let entries = log.entries;

  if (filters.from) {
    entries = entries.filter(e => e.timestamp >= filters.from);
  }
  if (filters.to) {
    entries = entries.filter(e => e.timestamp <= filters.to);
  }
  if (filters.action) {
    entries = entries.filter(e => e.action === filters.action);
  }
  if (filters.actor) {
    entries = entries.filter(e => e.actor === filters.actor);
  }
  if (filters.entityId) {
    entries = entries.filter(e => e.entityId === filters.entityId);
  }

  const total = entries.length;
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  entries = entries.slice(offset, offset + limit);

  return { entries, total };
}

module.exports = {
  appendAuditEntry,
  queryAuditLog,
  AUDIT_LOG_KEY
};
