import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiRequest = vi.fn();
vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

import { useDecomposer, _resetForTesting } from '../../client/composables/useDecomposer.js';

describe('useDecomposer', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
    _resetForTesting();
  });

  it('initializes with empty state', () => {
    const { snapshot, loading, error } = useDecomposer();
    expect(snapshot.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('load fetches the snapshot from the decomposer endpoint', async () => {
    const data = { runs: [{ run_id: 'r1' }], strategies: [], aggregates: { total_epics: 9 } };
    mockApiRequest.mockResolvedValue(data);

    const { snapshot, load } = useDecomposer();
    await load();

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/ai-impact/decomposer');
    expect(snapshot.value).toEqual(data);
  });

  it('load sets error on failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'));
    const { error, load } = useDecomposer();
    await load();
    expect(error.value).toBe('Network error');
  });

  it('load manages loading state', async () => {
    mockApiRequest.mockResolvedValue({ runs: [], strategies: [], aggregates: {} });
    const { loading, load } = useDecomposer();
    const p = load();
    expect(loading.value).toBe(true);
    await p;
    expect(loading.value).toBe(false);
  });
});
