import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '@shared/client/services/api.js';
import { useShowcase, _resetForTesting } from '../../client/composables/useShowcase.js';

beforeEach(() => {
  _resetForTesting();
  vi.clearAllMocks();
});

describe('useShowcase', () => {
  it('returns reactive state', () => {
    apiRequest.mockResolvedValue({ entries: [], pillars: [], fetchedAt: null, totalEntries: 0 });
    const { entries, pillars, meta, error } = useShowcase();

    expect(entries.value).toEqual([]);
    expect(pillars.value).toEqual([]);
    expect(meta.value).toEqual({ fetchedAt: null, totalEntries: 0 });
    expect(error.value).toBeNull();
  });

  it('fetches entries on first call', async () => {
    const mockData = {
      entries: [{ slug: 'test', title: 'Test' }],
      pillars: [{ pillarKey: 'agentic-ai', title: 'Agentic AI' }],
      fetchedAt: '2026-06-22T10:00:00Z',
      totalEntries: 1,
    };
    apiRequest.mockResolvedValue(mockData);

    const { entries, pillars, meta, loadEntries } = useShowcase();

    await loadEntries();

    expect(apiRequest).toHaveBeenCalledWith('/modules/ai-catalyst/showcase/entries');
    expect(entries.value).toEqual(mockData.entries);
    expect(pillars.value).toEqual(mockData.pillars);
    expect(meta.value.totalEntries).toBe(1);
  });

  it('sets error on fetch failure', async () => {
    apiRequest.mockRejectedValue(new Error('Network error'));

    const { error, loadEntries } = useShowcase();

    await loadEntries();

    expect(error.value).toBe('Network error');
  });

  it('loadEntryDetail fetches and caches by slug', async () => {
    apiRequest.mockResolvedValue({ entries: [], pillars: [] });
    const { loadEntryDetail } = useShowcase();

    const mockDetail = { entry: { slug: 'test' }, pillar: null };
    apiRequest.mockResolvedValue(mockDetail);

    const result1 = await loadEntryDetail('test');
    const result2 = await loadEntryDetail('test');

    expect(result1).toEqual(mockDetail);
    expect(result2).toEqual(mockDetail);
    expect(apiRequest).toHaveBeenCalledWith('/modules/ai-catalyst/showcase/entries/test');
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });
});
