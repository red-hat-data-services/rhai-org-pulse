/**
 * Integration test for classification endpoint
 * Tests the webhook endpoint that receives Jira issue keys
 */

const { classifyAndWrite, shouldClassify, CONFIG } = require('../index');

describe('classification endpoint logic', () => {
  describe('shouldClassify', () => {
    it('should return true for AIPCC Story', () => {
      const issue = {
        project: 'AIPCC',
        issueType: 'Story'
      };
      expect(shouldClassify(issue)).toBe(true);
    });

    it('should return false for non-configured project', () => {
      const issue = {
        project: 'OTHER',
        issueType: 'Story'
      };
      expect(shouldClassify(issue)).toBe(false);
    });

    it('should return false for non-configured issue type', () => {
      const issue = {
        project: 'AIPCC',
        issueType: 'Sub-task'
      };
      expect(shouldClassify(issue)).toBe(false);
    });

    it('should return true for Vulnerability issue type', () => {
      const issue = {
        project: 'AIPCC',
        issueType: 'Vulnerability'
      };
      expect(shouldClassify(issue)).toBe(true);
    });

    it('should return true for Weakness issue type', () => {
      const issue = {
        project: 'AIPCC',
        issueType: 'Weakness'
      };
      expect(shouldClassify(issue)).toBe(true);
    });
  });

  describe('classifyAndWrite', () => {
    it('should skip already-classified issues', async () => {
      const issue = {
        key: 'AIPCC-12345',
        issueType: 'Bug',
        summary: 'Fix broken API',
        activityType: 'Tech Debt & Quality'
      };

      const result = await classifyAndWrite(issue, { dryRun: true });

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('already-classified');
    });

    it('should skip low-confidence classifications', async () => {
      const issue = {
        key: 'AIPCC-12345',
        issueType: 'Task',
        summary: 'Update configuration files'
      };

      const result = await classifyAndWrite(issue, { dryRun: true });

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('low-confidence');
      expect(result.classification.confidence).toBe(0.60); // default heuristic
    });

    it('should classify high-confidence issue (dry run)', async () => {
      const issue = {
        key: 'AIPCC-12345',
        issueType: 'Bug',
        summary: 'Fix broken API endpoint'
      };

      const result = await classifyAndWrite(issue, { dryRun: true });

      expect(result.classified).toBe(true);
      expect(result.written).toBe(false);
      expect(result.dryRun).toBe(true);
      expect(result.classification.category).toBe('Tech Debt & Quality');
      expect(result.classification.confidence).toBe(0.95);
    });

    it('should respect custom confidence threshold', async () => {
      const issue = {
        key: 'AIPCC-12345',
        issueType: 'Story',
        summary: 'Update user dashboard layout'
      };

      // With default threshold (0.85), this should be skipped (confidence 0.60)
      const result1 = await classifyAndWrite(issue, { dryRun: true });
      expect(result1.skipped).toBe(true);

      // With lower threshold (0.50), should classify
      const result2 = await classifyAndWrite(issue, { dryRun: true, confidenceThreshold: 0.50 });
      expect(result2.classified).toBe(true);
      expect(result2.classification.category).toBe('New Features');
    });

    it('should handle classification with keyword match', async () => {
      const issue = {
        key: 'AIPCC-12345',
        issueType: 'Story',
        summary: 'Refactor authentication module for better performance'
      };

      const result = await classifyAndWrite(issue, { dryRun: true });

      expect(result.classified).toBe(true);
      expect(result.classification.category).toBe('Tech Debt & Quality');
      expect(result.classification.confidence).toBe(0.85);
      expect(result.classification.method).toBe('keyword');
    });
  });

  describe('CONFIG', () => {
    it('should have correct default configuration', () => {
      expect(CONFIG.enabled).toBe(true);
      expect(CONFIG.projects).toContain('AIPCC');
      expect(CONFIG.confidenceThreshold).toBe(0.85);
      expect(CONFIG.issueTypes).toEqual(['Story', 'Bug', 'Spike', 'Task', 'Epic', 'Vulnerability', 'Weakness']);
    });
  });
});
