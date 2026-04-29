import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the api module
const mockApiRequest = vi.fn();
vi.mock('@shared/client/services/api.js', () => ({
  apiRequest: (...args) => mockApiRequest(...args)
}));

import { useAssessments } from '../../client/composables/useAssessments.js';

describe('useAssessments', () => {
  beforeEach(() => {
    mockApiRequest.mockReset();
  });

  it('initializes with empty state', () => {
    const { assessments, assessmentLoading, assessmentError } = useAssessments();
    expect(assessments.value).toEqual({});
    expect(assessmentLoading.value).toBe(false);
    expect(assessmentError.value).toBeNull();
  });

  it('loadAssessments fetches and stores slim assessment data', async () => {
    const mockData = {
      lastSyncedAt: '2026-04-19T12:00:00Z',
      totalAssessed: 2,
      assessments: {
        'A': { total: 8, passFail: 'PASS', scores: {} },
        'B': { total: 3, passFail: 'FAIL', scores: {} }
      }
    };
    mockApiRequest.mockResolvedValue(mockData);

    const { assessments, assessmentMeta, loadAssessments } = useAssessments();
    await loadAssessments();

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/ai-impact/assessments');
    expect(assessments.value).toEqual(mockData.assessments);
    expect(assessmentMeta.value.totalAssessed).toBe(2);
  });

  it('loadAssessments sets error on failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'));

    const { assessmentError, loadAssessments } = useAssessments();
    await loadAssessments();

    expect(assessmentError.value).toBe('Network error');
  });

  it('loadAssessments manages loading state', async () => {
    mockApiRequest.mockResolvedValue({ assessments: {} });

    const { assessmentLoading, loadAssessments } = useAssessments();
    const promise = loadAssessments();
    // Loading should be true during fetch
    expect(assessmentLoading.value).toBe(true);
    await promise;
    expect(assessmentLoading.value).toBe(false);
  });

  it('loadAssessmentDetail fetches full detail for a key', async () => {
    const detail = {
      latest: { scores: {}, total: 8, passFail: 'PASS' },
      history: [{ total: 5, passFail: 'PASS', assessedAt: '2026-04-10T00:00:00Z' }]
    };
    mockApiRequest.mockResolvedValue(detail);

    const { loadAssessmentDetail } = useAssessments();
    const result = await loadAssessmentDetail('RHAIRFE-1');

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/ai-impact/assessments/RHAIRFE-1');
    expect(result).toEqual(detail);
  });

  it('loadAssessmentDetail caches results', async () => {
    const detail = { latest: {}, history: [] };
    mockApiRequest.mockResolvedValue(detail);

    const { loadAssessmentDetail } = useAssessments();
    await loadAssessmentDetail('RHAIRFE-1');
    const result2 = await loadAssessmentDetail('RHAIRFE-1');

    // Only one API call should have been made
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result2).toEqual(detail);
  });

  it('loadAssessmentDetail returns null for 404', async () => {
    mockApiRequest.mockRejectedValue(new Error('404 Not Found'));

    const { loadAssessmentDetail } = useAssessments();
    const result = await loadAssessmentDetail('NONEXIST');
    expect(result).toBeNull();
  });

  it('loadAssessmentDetail throws for non-404 errors', async () => {
    mockApiRequest.mockRejectedValue(new Error('Server error'));

    const { loadAssessmentDetail } = useAssessments();
    await expect(loadAssessmentDetail('KEY')).rejects.toThrow('Server error');
  });
});
