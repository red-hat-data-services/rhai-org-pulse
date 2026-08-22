import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractLinkedKey } from '../../server/jira/link-resolver.js';

const CONFIG = {
  linkTypeName: 'Cloners',
  linkedProject: 'RHAISTRAT'
};

describe('extractLinkedKey', () => {
  it('returns correct key for matching link type and project', () => {
    const links = [
      { type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-123' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBe('RHAISTRAT-123');
  });

  it('returns null for non-matching link types', () => {
    const links = [
      { type: { name: 'Blocks' }, outwardIssue: { key: 'RHAISTRAT-123' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBeNull();
  });

  it('returns key from inwardIssue when outwardIssue is absent', () => {
    const links = [
      { type: { name: 'Cloners' }, inwardIssue: { key: 'RHAISTRAT-123' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBe('RHAISTRAT-123');
  });

  it('prefers outwardIssue over inwardIssue when both are present', () => {
    const links = [
      { type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-100' }, inwardIssue: { key: 'RHAISTRAT-200' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBe('RHAISTRAT-100');
  });

  it('returns null when inwardIssue is a different project', () => {
    const links = [
      { type: { name: 'Cloners' }, inwardIssue: { key: 'OTHER-123' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBeNull();
  });

  it('returns null when outward issue is a different project', () => {
    const links = [
      { type: { name: 'Cloners' }, outwardIssue: { key: 'OTHER-123' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBeNull();
  });

  it('returns first matching link key', () => {
    const links = [
      { type: { name: 'Blocks' }, outwardIssue: { key: 'RHAISTRAT-100' } },
      { type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-200' } },
      { type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-300' } }
    ];
    expect(extractLinkedKey(links, CONFIG)).toBe('RHAISTRAT-200');
  });

  it('returns null for empty links', () => {
    expect(extractLinkedKey([], CONFIG)).toBeNull();
  });
});

describe('resolveLinkedFeatures', () => {
  // We test resolveLinkedFeatures by providing a mock jiraRequest that
  // fetchAllJqlResults will call internally. Since fetchAllJqlResults
  // is imported from shared/server/jira via CommonJS, we test the logic
  // by providing a jiraRequest mock that returns the expected pagination format.

  let resolveLinkedFeatures;

  beforeEach(async () => {
    const mod = await import('../../server/jira/link-resolver.js');
    resolveLinkedFeatures = mod.resolveLinkedFeatures;
  });

  function makeJiraRequest(responseIssues) {
    return vi.fn().mockResolvedValue({
      issues: responseIssues,
      isLast: true
    });
  }

  it('deduplicates linked keys across multiple RFEs', async () => {
    const mockJiraRequest = makeJiraRequest([
      { key: 'RHAISTRAT-1', fields: { summary: 'Strat 1', status: { name: 'Active' }, fixVersions: [] } }
    ]);

    const issues = [
      { key: 'RFE-1', _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-1' } }], linkedFeature: null },
      { key: 'RFE-2', _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-1' } }], linkedFeature: null }
    ];

    const result = await resolveLinkedFeatures(mockJiraRequest, issues, CONFIG);

    // Only one JQL call since both link to the same key
    expect(mockJiraRequest).toHaveBeenCalledTimes(1);
    expect(result[0].linkedFeature.key).toBe('RHAISTRAT-1');
    expect(result[1].linkedFeature.key).toBe('RHAISTRAT-1');
  });

  it('maps results back to correct RFE indices', async () => {
    const mockJiraRequest = makeJiraRequest([
      { key: 'RHAISTRAT-A', fields: { summary: 'Strat A', status: { name: 'Done' }, fixVersions: [{ name: 'v2.16' }] } },
      { key: 'RHAISTRAT-B', fields: { summary: 'Strat B', status: { name: 'New' }, fixVersions: [] } }
    ]);

    const issues = [
      { key: 'RFE-1', _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-A' } }], linkedFeature: null },
      { key: 'RFE-2', _rawIssueLinks: [], linkedFeature: null },
      { key: 'RFE-3', _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-B' } }], linkedFeature: null }
    ];

    const result = await resolveLinkedFeatures(mockJiraRequest, issues, CONFIG);

    expect(result[0].linkedFeature).toEqual({ key: 'RHAISTRAT-A', summary: 'Strat A', status: 'Done', fixVersions: ['v2.16'] });
    expect(result[1].linkedFeature).toBeNull();
    expect(result[2].linkedFeature).toEqual({ key: 'RHAISTRAT-B', summary: 'Strat B', status: 'New', fixVersions: [] });
  });

  it('handles missing linked issues (deleted in Jira)', async () => {
    const mockJiraRequest = makeJiraRequest([]); // key not found

    const issues = [
      { key: 'RFE-1', _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-DELETED' } }], linkedFeature: null }
    ];

    const result = await resolveLinkedFeatures(mockJiraRequest, issues, CONFIG);

    expect(result[0].linkedFeature).toBeNull();
  });

  it('cleans up _rawIssueLinks from output', async () => {
    const mockJiraRequest = makeJiraRequest([
      { key: 'RHAISTRAT-1', fields: { summary: 'Test', status: { name: 'Done' }, fixVersions: [] } }
    ]);

    const issues = [
      { key: 'RFE-1', _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: 'RHAISTRAT-1' } }], linkedFeature: null },
      { key: 'RFE-2', _rawIssueLinks: [], linkedFeature: null }
    ];

    const result = await resolveLinkedFeatures(mockJiraRequest, issues, CONFIG);

    for (const issue of result) {
      expect(issue._rawIssueLinks).toBeUndefined();
    }
  });

  it('returns issues unchanged when no linked keys exist', async () => {
    const mockJiraRequest = vi.fn();

    const issues = [
      { key: 'RFE-1', _rawIssueLinks: [], linkedFeature: null },
      { key: 'RFE-2', _rawIssueLinks: [{ type: { name: 'Blocks' }, outwardIssue: { key: 'OTHER-1' } }], linkedFeature: null }
    ];

    const result = await resolveLinkedFeatures(mockJiraRequest, issues, CONFIG);

    expect(mockJiraRequest).not.toHaveBeenCalled();
    expect(result[0].linkedFeature).toBeNull();
    expect(result[1].linkedFeature).toBeNull();
  });

  it('chunks at the 50-key boundary', async () => {
    // Create 120 issues, each linking to a unique key
    const issues = [];
    for (let i = 0; i < 120; i++) {
      issues.push({
        key: `RFE-${i}`,
        _rawIssueLinks: [{ type: { name: 'Cloners' }, outwardIssue: { key: `RHAISTRAT-${i}` } }],
        linkedFeature: null
      });
    }

    const mockJiraRequest = makeJiraRequest([]);

    await resolveLinkedFeatures(mockJiraRequest, issues, CONFIG);

    // 120 unique keys / 50 per chunk = 3 calls to fetchAllJqlResults
    // fetchAllJqlResults calls jiraRequest once per chunk (since isLast=true)
    expect(mockJiraRequest).toHaveBeenCalledTimes(3);
  });
});
