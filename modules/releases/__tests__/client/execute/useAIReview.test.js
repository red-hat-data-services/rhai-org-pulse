import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiRequest = vi.fn();
vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

import { useAIReview } from '../../../client/execute/composables/useAIReview.js';

describe('useAIReview', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it('initializes with empty state', () => {
    const { aiReview, aiReviewLoading, aiReviewError } = useAIReview();
    expect(aiReview.value).toBeNull();
    expect(aiReviewLoading.value).toBe(false);
    expect(aiReviewError.value).toBeNull();
  });

  it('loads feature review data on happy path', async () => {
    const featureData = {
      latest: { recommendation: 'approve', scores: { total: 7 } },
      history: []
    };
    mockApiRequest.mockResolvedValue(featureData);

    const { aiReview, aiReviewLoading, loadAIReview } = useAIReview();
    await loadAIReview('RHAISTRAT-123');

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/ai-impact/features/RHAISTRAT-123');
    expect(aiReview.value).toEqual(featureData);
    expect(aiReviewLoading.value).toBe(false);
  });

  it('does not fetch RFE assessment separately', async () => {
    const featureData = {
      latest: { recommendation: 'approve', sourceRfe: 'RHAIRFE-456' },
      history: []
    };
    mockApiRequest.mockResolvedValue(featureData);

    const { aiReview, loadAIReview } = useAIReview();
    await loadAIReview('RHAISTRAT-123');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(aiReview.value).toEqual(featureData);
  });

  it('handles 404 gracefully (no AI Impact data)', async () => {
    const err = new Error('Not Found');
    err.status = 404;
    mockApiRequest.mockRejectedValue(err);

    const { aiReview, aiReviewError, loadAIReview } = useAIReview();
    await loadAIReview('RHAISTRAT-999');

    expect(aiReview.value).toBeNull();
    expect(aiReviewError.value).toBeNull();
  });

  it('sets error for non-404 failures', async () => {
    const err = new Error('Server error');
    err.status = 500;
    mockApiRequest.mockRejectedValue(err);

    const { aiReviewError, loadAIReview } = useAIReview();
    await loadAIReview('RHAISTRAT-123');

    expect(aiReviewError.value).toBe('Server error');
  });

  it('manages loading state', async () => {
    mockApiRequest.mockResolvedValue({ latest: {}, history: [] });

    const { aiReviewLoading, loadAIReview } = useAIReview();
    const promise = loadAIReview('RHAISTRAT-123');
    expect(aiReviewLoading.value).toBe(true);
    await promise;
    expect(aiReviewLoading.value).toBe(false);
  });

  it('resets state before each load', async () => {
    const featureData = { latest: { recommendation: 'approve' }, history: [] };
    mockApiRequest.mockResolvedValue(featureData);

    const { aiReview, loadAIReview } = useAIReview();
    await loadAIReview('RHAISTRAT-1');
    expect(aiReview.value).toBeTruthy();

    const err = new Error('Not Found');
    err.status = 404;
    mockApiRequest.mockRejectedValue(err);
    await loadAIReview('RHAISTRAT-2');
    expect(aiReview.value).toBeNull();
  });
});
