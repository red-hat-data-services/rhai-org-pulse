import { describe, it, expect } from 'vitest';
import {
  generate2WeekPeriods,
  computeLeadTimeDays,
  bucketIssuesByPeriod,
  computeBacklogHealth
} from '../calculations.js';

describe('throughput/calculations', () => {
  describe('generate2WeekPeriods', () => {
    it('generates 12 two-week periods by default', () => {
      const periods = generate2WeekPeriods(12);
      expect(periods).toHaveLength(12);

      // Each period should be 14 days
      const first = periods[0];
      const diffDays = (first.end - first.start) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(14);
    });

    it('periods are consecutive and non-overlapping', () => {
      const periods = generate2WeekPeriods(6);
      for (let i = 1; i < periods.length; i++) {
        expect(periods[i].start.getTime()).toBe(periods[i - 1].end.getTime());
      }
    });

    it('periods are ordered oldest to newest', () => {
      const periods = generate2WeekPeriods(6);
      for (let i = 1; i < periods.length; i++) {
        expect(periods[i].start.getTime()).toBeGreaterThan(periods[i - 1].start.getTime());
      }
    });

    it('key format is YYYY-MM-DD', () => {
      const periods = generate2WeekPeriods(1);
      expect(periods[0].key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('computeLeadTimeDays', () => {
    it('computes lead time from created to resolved', () => {
      const issue = {
        created: '2026-01-01T00:00:00Z',
        resolutionDate: '2026-01-15T00:00:00Z'
      };
      expect(computeLeadTimeDays(issue)).toBe(14);
    });

    it('returns null if resolutionDate missing', () => {
      const issue = { created: '2026-01-01T00:00:00Z' };
      expect(computeLeadTimeDays(issue)).toBeNull();
    });

    it('returns null if created missing', () => {
      const issue = { resolutionDate: '2026-01-15T00:00:00Z' };
      expect(computeLeadTimeDays(issue)).toBeNull();
    });

    it('handles fractional days correctly', () => {
      const issue = {
        created: '2026-01-01T00:00:00Z',
        resolutionDate: '2026-01-01T12:00:00Z'
      };
      expect(computeLeadTimeDays(issue)).toBe(0.5);
    });
  });

  describe('bucketIssuesByPeriod', () => {
    it('buckets issues into correct 2-week periods', () => {
      const periods = generate2WeekPeriods(2);
      const issues = [
        {
          key: 'TEST-1',
          resolutionDate: new Date(periods[0].start.getTime() + 86400000).toISOString(), // 1 day into period
          created: new Date(periods[0].start.getTime() - 3 * 86400000).toISOString(), // 3 days before
          cycleTimeDays: 2.5
        },
        {
          key: 'TEST-2',
          resolutionDate: new Date(periods[1].start.getTime() + 86400000).toISOString(), // 1 day into period
          created: new Date(periods[1].start.getTime() - 5 * 86400000).toISOString(), // 5 days before
          cycleTimeDays: 4.0
        }
      ];

      const buckets = bucketIssuesByPeriod(issues, periods);

      expect(buckets[periods[0].key].throughput).toBe(1);
      expect(buckets[periods[1].key].throughput).toBe(1);
      expect(buckets[periods[0].key].leadTimes[0]).toBeCloseTo(4, 0); // ~4 days
      expect(buckets[periods[1].key].leadTimes[0]).toBeCloseTo(6, 0); // ~6 days
    });

    it('handles issues without resolutionDate', () => {
      const periods = generate2WeekPeriods(1);
      const issues = [
        {
          key: 'TEST-1',
          created: '2026-01-01T00:00:00Z'
          // No resolutionDate
        }
      ];

      const buckets = bucketIssuesByPeriod(issues, periods);
      const bucket = buckets[periods[0].key];
      expect(bucket.throughput).toBe(0);
      expect(bucket.issues).toHaveLength(0);
    });

    it('collects cycle times from issues', () => {
      const periods = generate2WeekPeriods(1);
      const issues = [
        {
          key: 'TEST-1',
          resolutionDate: new Date(periods[0].start.getTime() + 86400000).toISOString(),
          created: new Date(periods[0].start.getTime()).toISOString(),
          cycleTimeDays: 2.5
        },
        {
          key: 'TEST-2',
          resolutionDate: new Date(periods[0].start.getTime() + 2 * 86400000).toISOString(),
          created: new Date(periods[0].start.getTime()).toISOString(),
          cycleTimeDays: 3.5
        }
      ];

      const buckets = bucketIssuesByPeriod(issues, periods);
      const bucket = buckets[periods[0].key];
      expect(bucket.cycleTimes).toHaveLength(2);
      expect(bucket.cycleTimes).toEqual([2.5, 3.5]);
    });

    it('ignores negative cycle times', () => {
      const periods = generate2WeekPeriods(1);
      const issues = [
        {
          key: 'TEST-1',
          resolutionDate: new Date(periods[0].start.getTime() + 86400000).toISOString(),
          created: new Date(periods[0].start.getTime()).toISOString(),
          cycleTimeDays: -1 // Invalid
        }
      ];

      const buckets = bucketIssuesByPeriod(issues, periods);
      const bucket = buckets[periods[0].key];
      expect(bucket.cycleTimes).toHaveLength(0);
    });
  });

  describe('computeBacklogHealth', () => {
    it('computes backlog count and average age', () => {
      const now = new Date();
      const issues = [
        { created: new Date(now.getTime() - 5 * 86400000).toISOString() }, // 5 days old
        { created: new Date(now.getTime() - 10 * 86400000).toISOString() } // 10 days old
      ];

      const result = computeBacklogHealth(issues);
      expect(result.count).toBe(2);
      expect(result.avgAgeDays).toBeCloseTo(7.5, 0);
    });

    it('handles empty backlog', () => {
      const result = computeBacklogHealth([]);
      expect(result.count).toBe(0);
      expect(result.avgAgeDays).toBeNull();
    });

    it('handles null input', () => {
      const result = computeBacklogHealth(null);
      expect(result.count).toBe(0);
      expect(result.avgAgeDays).toBeNull();
    });

    it('skips issues without created date', () => {
      const now = new Date();
      const issues = [
        { created: new Date(now.getTime() - 5 * 86400000).toISOString() },
        { /* no created */ }
      ];

      const result = computeBacklogHealth(issues);
      expect(result.count).toBe(2);
      // Avg should be based only on issues with created date
      expect(result.avgAgeDays).toBeCloseTo(2.5, 0);
    });
  });
});
