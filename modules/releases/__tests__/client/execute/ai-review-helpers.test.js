import { describe, it, expect } from 'vitest';
import {
  getRecommendationClass,
  getRecommendationLabel,
  getRecommendationTooltip,
  getScoreClass,
  getReviewStatusClass,
  getReviewStatusLabel,
  getReviewStatusTooltip
} from '../../../client/execute/utils/ai-review-helpers.js';

describe('ai-review-helpers', () => {
  describe('getRecommendationClass', () => {
    it('returns green for approve', () => {
      expect(getRecommendationClass('approve')).toContain('bg-green');
    });
    it('returns amber for revise', () => {
      expect(getRecommendationClass('revise')).toContain('bg-amber');
    });
    it('returns red for reject', () => {
      expect(getRecommendationClass('reject')).toContain('bg-red');
    });
    it('returns gray for unknown', () => {
      expect(getRecommendationClass('unknown')).toContain('bg-gray');
    });
  });

  describe('getRecommendationLabel', () => {
    it('returns Approve for approve', () => {
      expect(getRecommendationLabel('approve')).toBe('Approve');
    });
    it('returns Needs Revision for revise', () => {
      expect(getRecommendationLabel('revise')).toBe('Needs Revision');
    });
    it('returns Reject for reject', () => {
      expect(getRecommendationLabel('reject')).toBe('Reject');
    });
    it('returns raw value for unknown', () => {
      expect(getRecommendationLabel('custom')).toBe('custom');
    });
    it('returns N/A for falsy', () => {
      expect(getRecommendationLabel(null)).toBe('N/A');
    });
  });

  describe('getRecommendationTooltip', () => {
    it('returns tooltip for approve', () => {
      expect(getRecommendationTooltip('approve')).toContain('approval');
    });
    it('returns tooltip for revise', () => {
      expect(getRecommendationTooltip('revise')).toContain('flagged');
    });
    it('returns tooltip for reject', () => {
      expect(getRecommendationTooltip('reject')).toContain('significant concerns');
    });
    it('returns empty string for unknown', () => {
      expect(getRecommendationTooltip('unknown')).toBe('');
    });
  });

  describe('getScoreClass', () => {
    it('returns green for score 2', () => {
      expect(getScoreClass(2)).toContain('green');
    });
    it('returns amber for score 1', () => {
      expect(getScoreClass(1)).toContain('amber');
    });
    it('returns red for score 0', () => {
      expect(getScoreClass(0)).toContain('red');
    });
  });

  describe('getReviewStatusClass', () => {
    it('returns green for approved', () => {
      expect(getReviewStatusClass('approved')).toContain('bg-green');
    });
    it('returns amber for needs-review', () => {
      expect(getReviewStatusClass('needs-review')).toContain('bg-amber');
    });
    it('returns yellow for awaiting-review', () => {
      expect(getReviewStatusClass('awaiting-review')).toContain('bg-yellow');
    });
    it('returns gray for unknown', () => {
      expect(getReviewStatusClass('unknown')).toContain('bg-gray');
    });
  });

  describe('getReviewStatusLabel', () => {
    it('returns Approved for approved', () => {
      expect(getReviewStatusLabel('approved')).toBe('Approved');
    });
    it('returns Flagged for needs-review', () => {
      expect(getReviewStatusLabel('needs-review')).toBe('Flagged');
    });
    it('returns Awaiting Sign-off for awaiting-review', () => {
      expect(getReviewStatusLabel('awaiting-review')).toBe('Awaiting Sign-off');
    });
    it('returns Awaiting Sign-off for unknown', () => {
      expect(getReviewStatusLabel('unknown')).toBe('Awaiting Sign-off');
    });
  });

  describe('getReviewStatusTooltip', () => {
    it('returns tooltip for approved', () => {
      expect(getReviewStatusTooltip('approved')).toContain('signed off');
    });
    it('returns tooltip for needs-review', () => {
      expect(getReviewStatusTooltip('needs-review')).toContain('flagged');
    });
    it('returns tooltip for awaiting-review', () => {
      expect(getReviewStatusTooltip('awaiting-review')).toContain('human');
    });
    it('returns tooltip for unknown', () => {
      expect(getReviewStatusTooltip('unknown')).toContain('not yet been reviewed');
    });
  });
});
