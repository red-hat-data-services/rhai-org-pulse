import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api module
const mockApiRequest = vi.fn();
vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

import { useFeatures } from '../../client/composables/useFeatures.js';

describe('useFeatures', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it('initializes with empty state', () => {
    const { features, featureLoading, featureError } = useFeatures();
    expect(features.value).toEqual({});
    expect(featureLoading.value).toBe(false);
    expect(featureError.value).toBeNull();
  });

  it('loadFeatures fetches and stores slim feature data', async () => {
    const mockData = {
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalFeatures: 2,
      features: {
        'RHAISTRAT-1': { key: 'RHAISTRAT-1', scores: { total: 7 }, recommendation: 'approve' },
        'RHAISTRAT-2': { key: 'RHAISTRAT-2', scores: { total: 4 }, recommendation: 'revise' }
      }
    };
    mockApiRequest.mockResolvedValue(mockData);

    const { features, featureMeta, loadFeatures } = useFeatures();
    await loadFeatures();

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/ai-impact/features');
    expect(features.value).toEqual(mockData.features);
    expect(featureMeta.value.totalFeatures).toBe(2);
  });

  it('loadFeatures sets error on failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'));

    const { featureError, loadFeatures } = useFeatures();
    await loadFeatures();

    expect(featureError.value).toBe('Network error');
  });

  it('loadFeatures manages loading state', async () => {
    mockApiRequest.mockResolvedValue({ features: {} });

    const { featureLoading, loadFeatures } = useFeatures();
    const promise = loadFeatures();
    expect(featureLoading.value).toBe(true);
    await promise;
    expect(featureLoading.value).toBe(false);
  });

  it('loadFeatureDetail fetches full detail for a key', async () => {
    const detail = {
      latest: { key: 'RHAISTRAT-1', scores: { total: 7 } },
      history: [{ scores: { total: 5 }, reviewedAt: '2026-04-10T00:00:00Z' }]
    };
    mockApiRequest.mockResolvedValue(detail);

    const { loadFeatureDetail } = useFeatures();
    const result = await loadFeatureDetail('RHAISTRAT-1');

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/ai-impact/features/RHAISTRAT-1');
    expect(result).toEqual(detail);
  });

  it('loadFeatureDetail caches results', async () => {
    const detail = { latest: {}, history: [] };
    mockApiRequest.mockResolvedValue(detail);

    const { loadFeatureDetail } = useFeatures();
    await loadFeatureDetail('RHAISTRAT-1');
    const result2 = await loadFeatureDetail('RHAISTRAT-1');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result2).toEqual(detail);
  });

  it('loadFeatureDetail returns null for 404', async () => {
    mockApiRequest.mockRejectedValue(new Error('404 Not Found'));

    const { loadFeatureDetail } = useFeatures();
    const result = await loadFeatureDetail('NONEXIST');
    expect(result).toBeNull();
  });

  it('loadFeatureDetail throws for non-404 errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Server error'));

    const { loadFeatureDetail } = useFeatures();
    await expect(loadFeatureDetail('KEY')).rejects.toThrow('Server error');
  });
});
