// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  getStoragePrefix,
  createPrefixedStorage
} from '../../server/jira/config.js';

describe('getStoragePrefix', () => {
  it('returns data/{projectKey}/ prefix', () => {
    expect(getStoragePrefix('RHOAIENG')).toBe('data/RHOAIENG/');
  });

  it('works with different project keys', () => {
    expect(getStoragePrefix('RHAISTRAT')).toBe('data/RHAISTRAT/');
  });
});

describe('createPrefixedStorage', () => {
  it('prefixes keys on read', () => {
    const readStorage = vi.fn().mockReturnValue({ some: 'data' });
    const writeStorage = vi.fn();

    const { read } = createPrefixedStorage('data/RHOAIENG/', readStorage, writeStorage);

    const result = read('boards.json');

    expect(readStorage).toHaveBeenCalledWith('data/RHOAIENG/boards.json');
    expect(result).toEqual({ some: 'data' });
  });

  it('prefixes keys on write', () => {
    const readStorage = vi.fn();
    const writeStorage = vi.fn();

    const { write } = createPrefixedStorage('data/RHOAIENG/', readStorage, writeStorage);

    write('teams.json', { teams: [] });

    expect(writeStorage).toHaveBeenCalledWith('data/RHOAIENG/teams.json', { teams: [] });
  });

  it('handles nested keys', () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();

    const { read, write } = createPrefixedStorage('data/RHOAIENG/', readStorage, writeStorage);

    read('sprints/100.json');
    expect(readStorage).toHaveBeenCalledWith('data/RHOAIENG/sprints/100.json');

    write('sprints/100.json', { issues: [] });
    expect(writeStorage).toHaveBeenCalledWith('data/RHOAIENG/sprints/100.json', { issues: [] });
  });
});
