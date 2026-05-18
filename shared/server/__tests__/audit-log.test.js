import { describe, it, expect, beforeEach } from 'vitest'

const { appendAuditEntry, queryAuditLog } = require('../audit-log');

function createMockStorage() {
  const store = {};
  return {
    readFromStorage(key) { return store[key] || null; },
    writeToStorage(key, data) { store[key] = JSON.parse(JSON.stringify(data)); },
    _store: store
  };
}

describe('appendAuditEntry', () => {
  let storage;
  beforeEach(() => { storage = createMockStorage(); });

  it('creates a new audit log if none exists', () => {
    const entry = appendAuditEntry(storage, {
      action: 'team.create',
      actor: 'admin@example.com',
      entityType: 'team',
      entityId: 'team_abc123',
      entityLabel: 'Platform'
    });

    expect(entry.id).toMatch(/^evt_/);
    expect(entry.action).toBe('team.create');
    expect(entry.actor).toBe('admin@example.com');
    expect(entry.timestamp).toBeTruthy();

    const log = storage.readFromStorage('audit-log.json');
    expect(log.entries).toHaveLength(1);
  });

  it('prepends entries (newest first)', () => {
    appendAuditEntry(storage, { action: 'first', actor: 'a', entityType: 't', entityId: '1' });
    appendAuditEntry(storage, { action: 'second', actor: 'a', entityType: 't', entityId: '2' });

    const log = storage.readFromStorage('audit-log.json');
    expect(log.entries[0].action).toBe('second');
    expect(log.entries[1].action).toBe('first');
  });

  it('enforces max entries cap', () => {
    // Set a small cap
    storage.writeToStorage('audit-log.json', { entries: [], maxEntries: 3 });

    for (let i = 0; i < 5; i++) {
      appendAuditEntry(storage, { action: `action_${i}`, actor: 'a', entityType: 't', entityId: `${i}` });
    }

    const log = storage.readFromStorage('audit-log.json');
    expect(log.entries).toHaveLength(3);
    expect(log.entries[0].action).toBe('action_4');
  });
});

describe('queryAuditLog', () => {
  let storage;
  beforeEach(() => {
    storage = createMockStorage();
    storage.writeToStorage('audit-log.json', {
      entries: [
        { id: 'evt_3', timestamp: '2026-04-20T15:00:00Z', actor: 'admin@example.com', action: 'team.create', entityType: 'team', entityId: 'team_1' },
        { id: 'evt_2', timestamp: '2026-04-20T14:00:00Z', actor: 'mgr@example.com', action: 'person.team.assign', entityType: 'person', entityId: 'bsmith' },
        { id: 'evt_1', timestamp: '2026-04-20T13:00:00Z', actor: 'admin@example.com', action: 'field.create', entityType: 'field', entityId: 'field_1' }
      ]
    });
  });

  it('returns all entries without filters', () => {
    const result = queryAuditLog(storage);
    expect(result.total).toBe(3);
    expect(result.entries).toHaveLength(3);
  });

  it('filters by action', () => {
    const result = queryAuditLog(storage, { action: 'team.create' });
    expect(result.total).toBe(1);
    expect(result.entries[0].id).toBe('evt_3');
  });

  it('filters by actor', () => {
    const result = queryAuditLog(storage, { actor: 'mgr@example.com' });
    expect(result.total).toBe(1);
  });

  it('filters by entityId', () => {
    const result = queryAuditLog(storage, { entityId: 'bsmith' });
    expect(result.total).toBe(1);
  });

  it('supports pagination', () => {
    const result = queryAuditLog(storage, { limit: 1, offset: 1 });
    expect(result.total).toBe(3);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('evt_2');
  });

  it('filters by date range', () => {
    const result = queryAuditLog(storage, { from: '2026-04-20T14:00:00Z', to: '2026-04-20T15:00:00Z' });
    expect(result.total).toBe(2);
  });
});
