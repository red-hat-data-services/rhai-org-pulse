import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createEventStore } from '../event-store.js';

describe('EventStore', () => {
  let tmpDir;
  let store;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-test-'));
    store = createEventStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends and reads events', () => {
    const event = {
      ts: '2026-05-11T15:30:00.000Z',
      page: 'team-tracker::home',
      email: 'user@redhat.com',
      userType: 'Backend',
      permissionTier: 'user',
    };
    store.append(event);
    const events = store.readMonth('2026-05');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it('returns empty array for non-existent month', () => {
    expect(store.readMonth('2099-01')).toEqual([]);
  });

  it('partitions events by month', () => {
    store.append({ ts: '2026-03-15T10:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    store.append({ ts: '2026-04-15T10:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    expect(store.readMonth('2026-03')).toHaveLength(1);
    expect(store.readMonth('2026-04')).toHaveLength(1);
  });

  it('lists month files', () => {
    store.append({ ts: '2026-03-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    store.append({ ts: '2026-05-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    const months = store.listMonthFiles();
    expect(months).toEqual(['2026-03', '2026-05']);
  });

  it('deletes a month file', () => {
    store.append({ ts: '2026-03-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    expect(store.readMonth('2026-03')).toHaveLength(1);
    store.deleteMonthFile('2026-03');
    expect(store.readMonth('2026-03')).toEqual([]);
  });

  it('rewrites a month file with filtered events', () => {
    store.append({ ts: '2026-03-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    store.append({ ts: '2026-03-15T00:00:00.000Z', page: 'a::c', email: 'b@b.com', userType: 'y', permissionTier: 'admin' });
    const events = store.readMonth('2026-03');
    store.rewriteMonth('2026-03', [events[1]]);
    const remaining = store.readMonth('2026-03');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].email).toBe('b@b.com');
  });

  it('buffers events during pruning', () => {
    store.startPruning();
    store.append({ ts: '2026-05-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    // During pruning, events should not be written
    expect(store.readMonth('2026-05')).toEqual([]);
    store.finishPruning();
    // After pruning, buffered events are flushed
    expect(store.readMonth('2026-05')).toHaveLength(1);
  });

  it('deletes all events', () => {
    store.append({ ts: '2026-03-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    store.append({ ts: '2026-04-01T00:00:00.000Z', page: 'a::b', email: 'a@b.com', userType: 'x', permissionTier: 'user' });
    store.deleteAllEvents();
    expect(store.listMonthFiles()).toEqual([]);
  });

  it('getMonthKey works correctly', () => {
    expect(store.getMonthKey('2026-01-15T00:00:00.000Z')).toBe('2026-01');
    expect(store.getMonthKey('2026-12-31T23:59:59.999Z')).toBe('2026-12');
    expect(store.getMonthKey(new Date('2026-06-01'))).toBe('2026-06');
  });
});
