import { describe, it, expect, vi } from 'vitest';
import { getConfig, saveConfig, DEFAULT_CONFIG, validateJqlSafeString } from '../../server/config.js';

describe('getConfig', () => {
  it('returns defaults when no file exists', async () => {
    const readFromStorage = vi.fn().mockResolvedValue(null);
    expect(await getConfig(readFromStorage)).toEqual(DEFAULT_CONFIG);
  });

  it('merges saved config with defaults', async () => {
    const readFromStorage = vi.fn().mockResolvedValue({ jiraProject: 'CUSTOM' });
    const config = await getConfig(readFromStorage);
    expect(config.jiraProject).toBe('CUSTOM');
    expect(config.linkedProject).toBe('RHAISTRAT'); // default
  });
});

describe('saveConfig', () => {
  it('saves valid config', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await saveConfig(writeToStorage, { jiraProject: 'MYPROJECT' });
    expect(writeToStorage).toHaveBeenCalledWith('ai-impact/config.json', expect.objectContaining({
      jiraProject: 'MYPROJECT',
      linkedProject: 'RHAISTRAT'
    }));
  });

  it('rejects JQL-unsafe characters in string fields', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await expect(saveConfig(writeToStorage, { jiraProject: 'BAD"PROJECT' })).rejects.toThrow('unsafe characters');
    await expect(saveConfig(writeToStorage, { jiraProject: "BAD'PROJECT" })).rejects.toThrow('unsafe characters');
    await expect(saveConfig(writeToStorage, { jiraProject: 'BAD(PROJECT)' })).rejects.toThrow('unsafe characters');
    await expect(saveConfig(writeToStorage, { jiraProject: 'BAD;PROJECT' })).rejects.toThrow('unsafe characters');
    await expect(saveConfig(writeToStorage, { jiraProject: 'BAD\\PROJECT' })).rejects.toThrow('unsafe characters');
  });

  it('rejects non-string values for string fields', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await expect(saveConfig(writeToStorage, { jiraProject: '' })).rejects.toThrow('non-empty string');
  });

  it('rejects non-integer lookbackMonths', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await expect(saveConfig(writeToStorage, { lookbackMonths: 1.5 })).rejects.toThrow('integer between 0 and 120');
    await expect(saveConfig(writeToStorage, { lookbackMonths: -1 })).rejects.toThrow('integer between 0 and 120');
    await expect(saveConfig(writeToStorage, { lookbackMonths: 121 })).rejects.toThrow('integer between 0 and 120');
  });

  it('rejects non-array excludedStatuses', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await expect(saveConfig(writeToStorage, { excludedStatuses: 'Closed' })).rejects.toThrow('must be an array');
  });

  it('rejects unsafe excludedStatuses entries', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await expect(saveConfig(writeToStorage, { excludedStatuses: ['Good', 'Bad"Status'] })).rejects.toThrow('unsafe characters');
  });

  it('validates trendThresholdPp range', async () => {
    const writeToStorage = vi.fn().mockResolvedValue(undefined);
    await expect(saveConfig(writeToStorage, { trendThresholdPp: -1 })).rejects.toThrow('number between 0 and 50');
    await expect(saveConfig(writeToStorage, { trendThresholdPp: 51 })).rejects.toThrow('number between 0 and 50');
    // Valid edge cases
    await saveConfig(writeToStorage, { trendThresholdPp: 0 });
    await saveConfig(writeToStorage, { trendThresholdPp: 50 });
  });
});

describe('validateJqlSafeString', () => {
  it('accepts safe strings', () => {
    expect(() => validateJqlSafeString('RHAIRFE', 'test')).not.toThrow();
    expect(() => validateJqlSafeString('rfe-creator-', 'test')).not.toThrow();
  });

  it('rejects unsafe strings', () => {
    expect(() => validateJqlSafeString('has"quote', 'test')).toThrow();
    expect(() => validateJqlSafeString("has'quote", 'test')).toThrow();
  });

  it('rejects empty strings', () => {
    expect(() => validateJqlSafeString('', 'test')).toThrow('non-empty string');
  });

  it('rejects non-strings', () => {
    expect(() => validateJqlSafeString(123, 'test')).toThrow('non-empty string');
  });
});
