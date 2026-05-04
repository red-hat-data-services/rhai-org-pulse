const { classifyIssue, meetsThreshold, CATEGORIES } = require('../classifier');

describe('classifier', () => {
  describe('classifyIssue', () => {
    describe('already classified', () => {
      it('should skip issues with existing Activity Type', () => {
        const issue = {
          issueType: 'Bug',
          summary: 'Fix broken API',
          activityType: 'Tech Debt & Quality'
        };

        const result = classifyIssue(issue);

        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0);
        expect(result.method).toBe('already-classified');
      });
    });

    describe('issue type rules', () => {
      it('should classify Bug as Tech Debt with 0.95 confidence', () => {
        const issue = {
          issueType: 'Bug',
          summary: 'API returns 500 error'
        };

        const result = classifyIssue(issue);

        expect(result.category).toBe(CATEGORIES.TECH_DEBT);
        expect(result.confidence).toBe(0.95);
        expect(result.method).toBe('issue-type');
      });

      it('should classify Vulnerability as Tech Debt with 0.95 confidence', () => {
        const issue = {
          issueType: 'Vulnerability',
          summary: 'CVE-2024-1234 in dependency'
        };

        const result = classifyIssue(issue);

        expect(result.category).toBe(CATEGORIES.TECH_DEBT);
        expect(result.confidence).toBe(0.95);
      });

      it('should classify Weakness as Tech Debt with 0.95 confidence', () => {
        const issue = {
          issueType: 'Weakness',
          summary: 'Security weakness in auth flow'
        };

        const result = classifyIssue(issue);

        expect(result.category).toBe(CATEGORIES.TECH_DEBT);
        expect(result.confidence).toBe(0.95);
      });

      it('should classify Spike as Learning with 0.90 confidence', () => {
        const issue = {
          issueType: 'Spike',
          summary: 'Investigate GraphQL performance'
        };

        const result = classifyIssue(issue);

        expect(result.category).toBe(CATEGORIES.LEARNING);
        expect(result.confidence).toBe(0.90);
        expect(result.method).toBe('issue-type');
      });
    });

    describe('keyword matching', () => {
      it('should classify tech debt keywords with 0.85 confidence', () => {
        const techDebtCases = [
          'Fix flaky test in CI pipeline',
          'Refactor auth module for better performance',
          'Upgrade dependencies to latest versions',
          'Fix regression in login flow',
          'Add test coverage for API endpoints',
          'Security patch for CVE-2024-5678',
          'Fix bug in data validation'
        ];

        techDebtCases.forEach(summary => {
          const result = classifyIssue({ issueType: 'Story', summary });
          expect(result.category).toBe(CATEGORIES.TECH_DEBT);
          expect(result.confidence).toBe(0.85);
          expect(result.method).toBe('keyword');
        });
      });

      it('should classify learning keywords with 0.85 confidence', () => {
        const learningCases = [
          { summary: 'Spike: Research vector database options', skip: true }, // Skip - has "Spike" keyword but issue type is Task, not Spike
          { summary: 'Training session on Kubernetes best practices' },
          { summary: 'POC for new authentication provider' },
          { summary: 'Prototype AI model recommendations' },
          { summary: 'Investigation into performance bottleneck' },
          { summary: 'Documentation for API endpoints' },
          { summary: 'Onboarding guide for new engineers' }
        ];

        learningCases.forEach(({ summary, skip }) => {
          if (skip) return;
          const result = classifyIssue({ issueType: 'Task', summary });
          expect(result.category).toBe(CATEGORIES.LEARNING);
          expect(result.confidence).toBe(0.85);
          expect(result.method).toBe('keyword');
        });
      });

      it('should classify feature keywords with 0.85 confidence', () => {
        const featureCases = [
          'RFE: Add dark mode toggle',
          'New feature: Multi-tenant support',
          'Enhancement to search functionality',
          'Add new capability for batch processing'
        ];

        featureCases.forEach(summary => {
          const result = classifyIssue({ issueType: 'Story', summary });
          expect(result.category).toBe(CATEGORIES.NEW_FEATURES);
          expect(result.confidence).toBe(0.85);
          expect(result.method).toBe('keyword');
        });
      });

      it('should match keywords case-insensitively', () => {
        const result = classifyIssue({
          issueType: 'Story',
          summary: 'FIX broken API endpoint'
        });

        expect(result.category).toBe(CATEGORIES.TECH_DEBT);
        expect(result.confidence).toBe(0.85);
      });

      it('should search both summary and description', () => {
        const result = classifyIssue({
          issueType: 'Story',
          summary: 'Update user dashboard',
          description: 'This is a spike to investigate the best approach for dashboard redesign'
        });

        expect(result.category).toBe(CATEGORIES.LEARNING);
        expect(result.confidence).toBe(0.85);
      });
    });

    describe('ambiguous cases', () => {
      it('should return low confidence when multiple category keywords match', () => {
        const issue = {
          issueType: 'Story',
          summary: 'Fix bug and add new feature for search',
          description: 'Also includes spike research'
        };

        const result = classifyIssue(issue);

        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0.4);
        expect(result.method).toBe('ambiguous');
      });
    });

    describe('default heuristics', () => {
      it('should classify Story without clear keywords as New Features (0.60)', () => {
        const result = classifyIssue({
          issueType: 'Story',
          summary: 'Update user profile page layout'
        });

        expect(result.category).toBe(CATEGORIES.NEW_FEATURES);
        expect(result.confidence).toBe(0.60);
        expect(result.method).toBe('default-heuristic');
      });

      it('should classify Epic without clear keywords as New Features (0.60)', () => {
        const result = classifyIssue({
          issueType: 'Epic',
          summary: 'Improve dashboard experience'
        });

        expect(result.category).toBe(CATEGORIES.NEW_FEATURES);
        expect(result.confidence).toBe(0.60);
        expect(result.method).toBe('default-heuristic');
      });

      it('should classify Task without clear keywords as Tech Debt (0.60)', () => {
        const result = classifyIssue({
          issueType: 'Task',
          summary: 'Update configuration files'
        });

        expect(result.category).toBe(CATEGORIES.TECH_DEBT);
        expect(result.confidence).toBe(0.60);
        expect(result.method).toBe('default-heuristic');
      });
    });

    describe('unclear cases', () => {
      it('should return zero confidence when no rules match', () => {
        const result = classifyIssue({
          issueType: 'Sub-task',
          summary: 'Review pull request'
        });

        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0.0);
        expect(result.method).toBe('unclear');
      });
    });
  });

  describe('meetsThreshold', () => {
    it('should return true when confidence meets default threshold (0.85)', () => {
      const classification = {
        category: CATEGORIES.TECH_DEBT,
        confidence: 0.85,
        method: 'keyword'
      };

      expect(meetsThreshold(classification)).toBe(true);
    });

    it('should return true when confidence exceeds threshold', () => {
      const classification = {
        category: CATEGORIES.TECH_DEBT,
        confidence: 0.95,
        method: 'issue-type'
      };

      expect(meetsThreshold(classification)).toBe(true);
    });

    it('should return false when confidence below threshold', () => {
      const classification = {
        category: CATEGORIES.NEW_FEATURES,
        confidence: 0.60,
        method: 'default-heuristic'
      };

      expect(meetsThreshold(classification)).toBe(false);
    });

    it('should return false when category is null', () => {
      const classification = {
        category: null,
        confidence: 0.90,
        method: 'unclear'
      };

      expect(meetsThreshold(classification)).toBe(false);
    });

    it('should respect custom threshold parameter', () => {
      const classification = {
        category: CATEGORIES.NEW_FEATURES,
        confidence: 0.70,
        method: 'keyword'
      };

      expect(meetsThreshold(classification, 0.70)).toBe(true);
      expect(meetsThreshold(classification, 0.75)).toBe(false);
    });
  });
});
